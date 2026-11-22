$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root 'Module_1_Adapter/src/modules/admin/routes.ts'
$frontend = Join-Path $root 'Module_3_Admin_Panel/src/app/creators/page.tsx'
$igBackend = Join-Path $root 'Module_1_Adapter/src/modules/instagram/routes.ts'
$igFrontend = Join-Path $root 'Module_3_Admin_Panel/src/app/instagram/page.tsx'
if (!(Test-Path $backend) -or !(Test-Path $frontend) -or !(Test-Path $igBackend) -or !(Test-Path $igFrontend)) { throw 'Extract this ZIP to PCI_Clean root, alongside all three Module directories.' }
$utf8 = New-Object System.Text.UTF8Encoding($false)
$b = [IO.File]::ReadAllText($backend)
$start = "adminRoutes.post('/creators/bulk',roles('owner','editor'),handler(async(req,res)=>{"
$end = "adminRoutes.patch('/creators/:id'"
$a=$b.IndexOf($start); $z=$b.IndexOf($end,$a)
if($a -lt 0 -or $z -lt 0){throw 'Backend bulk import section not found. No changes made.'}
if($b.Contains('PCI_SMART_BULK_IMPORT_V1')){throw 'YouTube smart import already installed. This unified patch is intended for the unmodified existing bulk endpoints.'}
$f=[IO.File]::ReadAllText($frontend)
$oldType="api<{created:number}>('/admin/creators/bulk'"
$oldMsg='setOk(`Imported ${r.created} creators successfully.`);setBulk('''');list.reload();'
if (!$f.Contains($oldType) -or !$f.Contains($oldMsg)) { throw 'Admin bulk import UI does not match expected version. No changes made.' }
$replacement=@'
// PCI_SMART_BULK_IMPORT_V1: Existing channels are never modified or revalidated.
// All new channel IDs are verified BEFORE an atomic insert of the new subset.
adminRoutes.post('/creators/bulk',roles('owner','editor'),handler(async(req,res)=>{
 const input=z.array(creator).min(1).max(100).parse(req.body?.creators);
 const unique=new Map<string,typeof input[number]>();
 const duplicatedInFile:string[]=[];
 for(const item of input){
   if(unique.has(item.channelId)){duplicatedInFile.push(item.channelId);continue;}
   unique.set(item.channelId,item);
 }
 const items=[...unique.values()];
 const ids=items.map(x=>x.channelId);
 const existing=await query<{channel_id:string;slug:string}>(
  'SELECT channel_id,slug FROM creators WHERE channel_id = ANY($1::text[]) OR slug = ANY($2::text[])',
  [ids,items.map(x=>x.slug)]);
 const byChannel=new Set(existing.rows.map(x=>x.channel_id));
 const skipped=items.filter(x=>byChannel.has(x.channelId)).map(x=>x.channelId);
 const fresh=items.filter(x=>!byChannel.has(x.channelId));
 const claimedSlugs=new Map(existing.rows.map(x=>[x.slug,x.channel_id]));
 const seenSlugs=new Map<string,string>();
 for(const item of fresh){
  const owner=claimedSlugs.get(item.slug)??seenSlugs.get(item.slug);
  if(owner && owner!==item.channelId)throw new HttpError(409,'SLUG_CONFLICT',
   `Slug ${item.slug} is already assigned to another channel; no records imported`);
  seenSlugs.set(item.slug,item.channelId);
 }
 if(fresh.length && !config.YOUTUBE_API_KEY)throw new HttpError(503,'YOUTUBE_UNCONFIGURED','Configure YouTube API key');
 if(fresh.length){
  const yt=new YoutubeClient(),valid=new Set<string>();
  for(const batch of chunks(fresh.map(x=>x.channelId),50))
   for(const c of await yt.channels(batch))valid.add(c.id);
  const invalid=fresh.filter(x=>!valid.has(x.channelId)).map(x=>x.channelId);
  if(invalid.length)throw new HttpError(400,'CHANNEL_NOT_FOUND',
   `Unverified YouTube IDs: ${invalid.join(', ')}. No records imported`);
 }
 let created=0;
 try{
  await transaction(async tx=>{
   for(const item of fresh){
    const r=await tx.query(`INSERT INTO creators(channel_id,slug,display_name,description,featured,enabled)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id`,
      [item.channelId,item.slug,item.displayName,item.description,item.featured,item.enabled]);
    if(!r.rowCount){skipped.push(item.channelId);continue;}
    created++;
    for(const cid of item.categoryIds)await tx.query(
      'INSERT INTO creator_categories(creator_id,category_id) VALUES($1,$2)',[r.rows[0].id,cid]);
   }
  });
 }catch(e:any){if(e.code==='23503')throw new HttpError(400,'CATEGORY_MISSING','Unknown category');throw e;}
 await auditAs(res,'creator.bulk_smart_import',null,{created,skipped:skipped.length,duplicatesInFile:duplicatedInFile.length});
 if(created)await bustPublicCache();
 res.status(200).json({data:{created,skipped:skipped.length,duplicatesInFile:duplicatedInFile.length,
  skippedChannelIds:skipped,duplicateChannelIds:duplicatedInFile}});
}));
'@
$b2=$b.Substring(0,$a)+$replacement+"`n"+$b.Substring($z)
$f2=$f.Replace($oldType,"api<{created:number;skipped:number;duplicatesInFile:number}>('/admin/creators/bulk'")
$f2=$f2.Replace($oldMsg,'setOk(`Added ${r.created} new creators; skipped ${r.skipped} existing channels and ${r.duplicatesInFile} duplicates in this file.`);setBulk('''');list.reload();')
$f2=$f2.Replace('The adapter verifies all channel IDs before committing the batch.','Existing channel IDs are skipped automatically; only new channel IDs are verified and imported.')
if ($f2 -eq $f) {throw 'Frontend update failed; no changes made.'}
# PCI shared import policy also applies to Instagram (username identity; slug cannot be reassigned).
$i=[IO.File]::ReadAllText($igBackend)
$igOld=@'
instagramAdminRoutes.post('/instagram/creators/bulk',roles('owner','editor'),handler(async(req,res)=>{
 const input=bulkSchema.parse(req.body?.creators);
 const count=await insertBatch(input,res);res.status(201).json({data:{created:count,status:'pending_review'}});
}));
'@
$igNew=@'
// PCI_SMART_BULK_IMPORT_V1: Same skip-existing/add-new policy as YouTube.
// Unchanged accounts retain all approvals, statistics, and their category links.
instagramAdminRoutes.post('/instagram/creators/bulk',roles('owner','editor'),handler(async(req,res)=>{
 const input=bulkSchema.parse(req.body?.creators);
 const unique=new Map<string,typeof input[number]>();
 let duplicatesInFile=0;
 for(const c of input){
  if(unique.has(c.username)){duplicatesInFile++;continue;}
  unique.set(c.username,c);
 }
 const list=[...unique.values()];
 const existing=await query<{username:string;slug:string}>(
  'SELECT username,slug FROM instagram_creators WHERE lower(username)=ANY($1::text[]) OR slug=ANY($2::text[])',
  [list.map(x=>x.username),list.map(x=>x.slug)]);
 const oldUsernames=new Set(existing.rows.map(x=>x.username.toLowerCase()));
 const fresh=list.filter(x=>!oldUsernames.has(x.username));
 const bySlug=new Map(existing.rows.map(x=>[x.slug,x.username.toLowerCase()]));
 for(const c of fresh){
  const owner=bySlug.get(c.slug);
  if(owner && owner!==c.username)throw new HttpError(409,'SLUG_CONFLICT',
   `Instagram slug ${c.slug} belongs to another profile; no profiles imported`);
  bySlug.set(c.slug,c.username);
 }
 // insertBatch checks duplicate slugs and inserts in a single transaction.
 const created=fresh.length?await insertBatch(fresh,res):0;
 res.status(200).json({data:{created,skipped:list.length-fresh.length,duplicatesInFile,status:'pending_review'}});
}));
'@
if (!$i.Contains($igOld.TrimEnd())) { throw 'Instagram bulk route differs from expected version; no changes made.' }
$i2=$i.Replace($igOld.TrimEnd(),$igNew.TrimEnd())
$igUi=[IO.File]::ReadAllText($igFrontend)
$igUiOld=@'
   await api('/admin/instagram/creators/bulk',{method:'POST',csrf,body:{creators:raw}});
   setBulk('');
  },'Profiles imported into pending review.');
'@
$igUiNew=@'
   const result=await api<{created:number;skipped:number;duplicatesInFile:number}>('/admin/instagram/creators/bulk',{method:'POST',csrf,body:{creators:raw}});
   setBulk('');
   return result;
  },'Import completed. Existing profiles preserved; check the registry for new pending profiles.');
'@
# The generic execute wrapper does not expose returned counts. Show counts by changing importBulk only.
$igUiNew=@'
   const result=await api<{created:number;skipped:number;duplicatesInFile:number}>('/admin/instagram/creators/bulk',{method:'POST',csrf,body:{creators:raw}});
   setBulk('');
   setOk(`Added ${result.created}; skipped ${result.skipped} existing profiles and ${result.duplicatesInFile} repeated usernames.`);
  },'');
'@
# execute sets the success notice after the callback; instead set a dedicated notice after execute.
# Replace the entire function to avoid overwriting the count message.
$igStart=' async function importBulk(){'
$igEnd=' async function review(c:Creator'
$aa=$igUi.IndexOf($igStart);$zz=$igUi.IndexOf($igEnd,$aa)
if($aa -lt 0 -or $zz -lt 0){throw 'Instagram admin import function not found; no changes made.'}
$igUiReplacement=@'
 async function importBulk(){
  setBusy(true);setError('');setOk('');
  try{
   const raw=JSON.parse(bulk) as unknown;
   if(!Array.isArray(raw)||raw.length<1||raw.length>100)throw new Error('Import 1–100 profile objects.');
   const result=await api<{created:number;skipped:number;duplicatesInFile:number}>('/admin/instagram/creators/bulk',{method:'POST',csrf,body:{creators:raw}});
   setOk(`Added ${result.created}; skipped ${result.skipped} existing profiles and ${result.duplicatesInFile} duplicate usernames in this JSON.`);
   setBulk('');reload();
  }catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
'@
$igUi2=$igUi.Substring(0,$aa)+$igUiReplacement+"`n"+$igUi.Substring($zz)
$igUi2=$igUi2.Replace('All entries remain pending, never automatically ranked.','New entries remain pending, never automatically ranked. Existing profiles are skipped without changes.')
if($igUi2 -eq $igUi){throw 'Instagram admin UI update failed; no changes made.'}
[IO.File]::WriteAllText($backend,$b2,$utf8)
[IO.File]::WriteAllText($frontend,$f2,$utf8)
[IO.File]::WriteAllText($igBackend,$i2,$utf8)
[IO.File]::WriteAllText($igFrontend,$igUi2,$utf8)
Write-Host 'Smart bulk import applied to existing YouTube and Instagram routes and admin screens. No new module created.'
