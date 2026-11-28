import {createHash} from 'node:crypto';
import {matchIdentity,type IdentityAccount} from './identity-match.js';
import {HttpError} from '../../lib/errors.js';
type Db={query(sql:string,values?:unknown[]):Promise<{rows:any[];rowCount:number|null}>};
type Choice={mode:'existing';personSlug:string;confirm:true}|{mode:'new';name:string;confirm:true};
export async function previewTikTokIdentity(c:Db,id:string){
 const s=(await c.query(`SELECT s.handle,s.person_name,s.display_name,s.person_id,p.slug AS linked_slug,s.published_at,
 a.id AS account_id,x.profile,x.observed_at,h.account_id IS NOT NULL AS hub_ready
 FROM public.scrappa_candidates s LEFT JOIN public.people p ON p.id=s.person_id
 LEFT JOIN public.accounts a ON a.platform='tiktok' AND a.external_id=s.external_id AND a.person_id=s.person_id AND a.handle=s.handle
 LEFT JOIN LATERAL (SELECT profile,observed_at FROM public.scrappa_snapshots WHERE external_id=s.external_id ORDER BY observed_at DESC,run_id DESC LIMIT 1) x ON true
 LEFT JOIN public.hub_tiktok_registered h ON h.external_id=s.external_id WHERE s.external_id=$1`,[id])).rows[0];
 if(!s)throw new HttpError(404,'NOT_FOUND','Candidate not found');
 const name=String(s.person_name||s.display_name||s.handle).trim().slice(0,120);
 const accounts=(await c.query(`SELECT p.id AS "personId",p.slug,p.display_name AS name,a.platform,a.handle FROM public.people p
 JOIN public.accounts a ON a.person_id=p.id WHERE NOT (a.platform='tiktok' AND a.external_id=$1) ORDER BY p.slug,a.platform,a.handle`,[id])).rows as IdentityAccount[];
 const matches=matchIdentity(s.handle,name,accounts);
 const linked=typeof s.linked_slug==='string'?s.linked_slug:null;
 const kind=matches.length>1?'ambiguous':matches.length===1?'existing':linked?'existing':'new';
 const personSlug=matches.length===1?matches[0].slug:linked;
 const repair=Boolean(linked&&personSlug&&linked!==personSlug);
 const at=Date.parse(s.observed_at??'');
 const ready=Number.isFinite(at)&&at<=Date.now()&&Date.now()-at<=15*86400000&&s.profile?.accountId===id&&s.profile?.handle===s.handle&&Number.isSafeInteger(s.profile?.followers)&&s.profile.followers>=0;
 const plan={id,handle:s.handle,name,kind,personSlug,linked,matches,repair,ready,registered:Boolean(s.account_id),hubReady:Boolean(s.hub_ready),published:Boolean(s.published_at)};
 return {...plan,token:createHash('sha256').update(JSON.stringify(plan)).digest('hex')};
}
export async function previewPublishedTikTokIdentities(c:Db){
 const ids=(await c.query('SELECT external_id FROM public.scrappa_candidates WHERE published_at IS NOT NULL ORDER BY external_id')).rows;
 const out=[];for(const r of ids)out.push(await previewTikTokIdentity(c,String(r.external_id)));
 return out;
}
/** Recompute the reviewed proposal under the registry lock; never blindly match or merge. */
export async function approveAutomaticTikTokIdentity(c:Db,id:string,token:string,actorId:string|null,requirePublished=true){
 await c.query('SELECT pg_advisory_xact_lock(710324)');
 const p=await previewTikTokIdentity(c,id);
 if(p.token!==token)throw new HttpError(409,'PCI_TIKTOK_REVIEW_CHANGED','Identity proposal changed. Review again.');
 if(!p.ready||(requirePublished&&!p.published))throw new HttpError(409,'PCI_TIKTOK_REVIEW_CHANGED','Recent verified profile required.');
 if(p.kind==='ambiguous')throw new HttpError(409,'PCI_TIKTOK_AMBIGUOUS','Multiple People match. Review manually; no new identity created.');
 if(p.registered&&!p.repair)throw new HttpError(409,'PCI_TIKTOK_REVIEW_CHANGED','Identity already assigned. Reload the review.');
 const choice:Choice=p.kind==='existing'&&p.personSlug?{mode:'existing',personSlug:p.personSlug,confirm:true}:{mode:'new',name:p.name,confirm:true};
 return registerCentralTikTokIdentity(c,id,choice,actorId,p.repair);
}
async function invalidateDrafts(c:Db){
 // Unpublished batches use the old registry; retain their runs for audit but prohibit publication.
 await c.query(`UPDATE public.rank_runs SET status='rejected',diagnostics=diagnostics||jsonb_build_object('gateFailures',jsonb_build_array(jsonb_build_object('gate','valid_references','message','Creator identity changed; rebuild rankings.'))) WHERE status='draft'`);
}
async function repairUnpublishedDuplicate(c:Db,id:string,old:any,s:any,personId:string){
 if(process.env.PCI_TIKTOK_CENTRAL!=='prepare')throw new HttpError(409,'PCI_TIKTOK_REPAIR_MODE','Duplicate correction requires preparation mode.');
 const previous=(await c.query('SELECT slug FROM public.people WHERE id=$1 FOR UPDATE',[old.person_id])).rows[0];
 if(previous?.slug!=='tiktok-'+id||s.person_id!==old.person_id||old.handle!==s.handle)throw new HttpError(409,'PCI_TIKTOK_REPAIR_UNSAFE','Only a temporary TikTok-only identity can be repaired automatically.');
 const unsafe=(await c.query(`SELECT EXISTS(SELECT 1 FROM public.accounts WHERE person_id=$1 AND id<>$2) OR
 EXISTS(SELECT 1 FROM public.person_categories WHERE person_id=$1) OR
 EXISTS(SELECT 1 FROM public.rank_history WHERE person_id=$1) OR
 EXISTS(SELECT 1 FROM public.rank_slots rs JOIN public.rank_runs rr ON rr.id=rs.run_id WHERE rs.person_id=$1 AND (rr.published_at IS NOT NULL OR rr.status NOT IN ('draft','rejected'))) OR
 EXISTS(SELECT 1 FROM public.scrappa_candidates WHERE person_id=$1 AND external_id<>$3) AS unsafe`,[old.person_id,old.id,id])).rows[0]?.unsafe;
 if(unsafe)throw new HttpError(409,'PCI_TIKTOK_REPAIR_UNSAFE','Existing account, category or published history requires a separately reviewed merge. Nothing changed.');
 await invalidateDrafts(c);
 await c.query('UPDATE public.accounts SET person_id=$2 WHERE id=$1',[old.id,personId]);
 await c.query('UPDATE public.scrappa_candidates SET person_id=$2 WHERE external_id=$1',[id,personId]);
 // Only rejected, never-published draft slots may be removed.
 await c.query("DELETE FROM public.rank_slots rs USING public.rank_runs rr WHERE rs.run_id=rr.id AND rs.person_id=$1 AND rr.status='rejected' AND rr.published_at IS NULL",[old.person_id]);
 const ident=(v:string)=>'"'+v.replaceAll('"','""')+'"';
 const refs=(await c.query(`SELECT n.nspname AS schema,t.relname AS relation,a.attname AS col,cardinality(k.conkey) AS width,b.attname AS target
 FROM pg_constraint k JOIN pg_class t ON t.oid=k.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
 JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.conkey[1] JOIN pg_attribute b ON b.attrelid=k.confrelid AND b.attnum=k.confkey[1]
 WHERE k.contype='f' AND k.confrelid='public.people'::regclass`)).rows;
 for(const ref of refs){
  if(Number(ref.width)!==1||ref.target!=='id'||(await c.query('SELECT 1 FROM '+ident(ref.schema)+'.'+ident(ref.relation)+' WHERE '+ident(ref.col)+'=$1 LIMIT 1',[old.person_id])).rowCount)
   throw new HttpError(409,'PCI_TIKTOK_REPAIR_UNSAFE','Unreviewed identity dependencies require manual review. Nothing changed.');
 }
 // Only the never-published temporary person is removed. Account ID and provider history stay unchanged.
 await c.query('DELETE FROM public.people WHERE id=$1',[old.person_id]);
}

/** Owner review only. A collected profile is evidence of an account, not proof of a cross-platform identity. */
export async function registerCentralTikTokIdentity(c:Db,id:string,choice:Choice,actorId:string|null,allowRepair=false){
 await c.query('SELECT pg_advisory_xact_lock(710324)');
 await c.query('SELECT pg_advisory_xact_lock(710325)');
 const s=(await c.query(`SELECT s.external_id,s.handle,s.person_id,s.published_at,s.niche,x.profile,x.observed_at
 FROM public.scrappa_candidates s JOIN LATERAL (SELECT profile,observed_at FROM public.scrappa_snapshots WHERE external_id=s.external_id ORDER BY observed_at DESC,run_id DESC LIMIT 1) x ON true
 WHERE s.external_id=$1 FOR UPDATE OF s`,[id])).rows[0];
 const at=Date.parse(s?.observed_at??'');
 if(!s||!Number.isFinite(at)||at>Date.now()||Date.now()-at>15*86400000||s.profile?.accountId!==id||s.profile?.handle!==s.handle||!Number.isSafeInteger(s.profile?.followers)||s.profile.followers<0)throw new HttpError(409,'PCI_TIKTOK_005','Collect a recent verified candidate profile before registration.');
 const old=(await c.query("SELECT id,person_id,handle FROM public.accounts WHERE platform='tiktok' AND external_id=$1 FOR UPDATE",[id])).rows[0];
 let personId:string;
 if(choice.mode==='existing'){
  const p=(await c.query('SELECT id FROM public.people WHERE slug=$1 FOR KEY SHARE',[choice.personSlug])).rows[0];
  if(!p)throw new HttpError(404,'PCI_TIKTOK_006','Existing People slug not found.');personId=p.id;
 }else{
  if((await previewTikTokIdentity(c,id)).matches.length)throw new HttpError(409,'PCI_TIKTOK_EXISTING_MATCH','Potential existing identity found. Review the automatic identity proposal.');
  if(old||s.person_id)throw new HttpError(409,'PCI_TIKTOK_007','Candidate already has a linked identity; use its existing People slug.');
  if((await c.query("SELECT 1 FROM public.people WHERE lower(regexp_replace(trim(display_name),'\\s+',' ','g'))=lower(regexp_replace(trim($1),'\\s+',' ','g'))",[choice.name])).rowCount)throw new HttpError(409,'PCI_TIKTOK_008','An existing person has this name. Review the identity and link its exact slug instead.');
  personId=(await c.query('INSERT INTO public.people(slug,display_name,created_by) VALUES($1,$2,$3) RETURNING id',['tiktok-'+id,choice.name,actorId])).rows[0].id;
 }
 const repair=Boolean(allowRepair&&old&&old.person_id!==personId&&old.handle===s.handle&&s.person_id===old.person_id);
 if(old&&(old.person_id!==personId||old.handle!==s.handle)&&!repair)throw new HttpError(409,'PCI_TIKTOK_003','Registered account identity differs; do not silently reassign it.');
 if(s.person_id&&s.person_id!==personId&&!repair)throw new HttpError(409,'PCI_TIKTOK_003','Existing staged identity differs; review and unlink before changing.');
 if((await c.query('SELECT 1 FROM public.scrappa_candidates WHERE person_id=$1 AND external_id<>$2',[personId,id])).rowCount)throw new HttpError(409,'PCI_TIKTOK_009','Person already has another staged TikTok account.');
 if((await c.query("SELECT 1 FROM public.accounts WHERE platform='tiktok' AND person_id=$1 AND external_id<>$2",[personId,id])).rowCount)throw new HttpError(409,'PCI_TIKTOK_009','Person already has another registered TikTok account.');
 if(repair)await repairUnpublishedDuplicate(c,id,old,s,personId);
 else if(!old||!s.published_at)await invalidateDrafts(c);
 const accountId=old?.id??(await c.query("INSERT INTO public.accounts(person_id,platform,external_id,handle) VALUES($1,'tiktok',$2,$3) RETURNING id",[personId,id,s.handle])).rows[0].id;
 await c.query('UPDATE public.scrappa_candidates SET person_id=$2,published_at=COALESCE(published_at,now()) WHERE external_id=$1',[id,personId]);
 await c.query('INSERT INTO public.admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[actorId,'scrappa.registry.approve',id,JSON.stringify({personId,accountId,mode:choice.mode,repairedTemporaryIdentity:repair,previousPersonId:repair?old.person_id:null})]);
 return {personId,accountId,publicationApproved:true};
}
