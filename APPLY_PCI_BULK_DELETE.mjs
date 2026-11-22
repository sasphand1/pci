import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
const backend='Module_1_Adapter/src/modules/admin/routes.ts';
const frontend='Module_3_Admin_Panel/src/app/creators/page.tsx';
function change(s,a,b,label){const p=s.indexOf(a);if(p<0||s.indexOf(a,p+1)>=0)throw Error('Unexpected source for '+label);return s.slice(0,p)+b+s.slice(p+a.length)}
let b=readFileSync(backend,'utf8'),f=readFileSync(frontend,'utf8');
const stamp='PCI_BULK_SOFT_DELETE_V1';
if(b.includes(stamp)&&f.includes(stamp)){console.log('Already installed');process.exit(0)}
if(b.includes(stamp)||f.includes(stamp))throw Error('Partial installation detected; inspect existing changes');
const endpoint=`// ${stamp}: owner-only, audited, reversible bulk disable.
adminRoutes.post('/creators/bulk-disable',roles('owner'),handler(async(req,res)=>{
 const input=z.object({ids:z.array(uuid).min(1).max(250),confirmation:z.literal('DISABLE SELECTED')}).strict().parse(req.body);
 const ids=[...new Set(input.ids)];
 const count=await transaction(async tx=>{
  await tx.query('SELECT pg_advisory_xact_lock(710324)');
  const updated=await tx.query('UPDATE creators SET enabled=false,featured=false,updated_at=now() WHERE id=ANY($1::uuid[]) AND enabled=true RETURNING id',[ids]);
  await tx.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[adminId(res),'creator.bulk_disable',null,JSON.stringify({selected:ids.length,disabled:updated.rowCount??0,ids})]);
  return updated.rowCount??0;
 });
 if(count)await bustPublicCache();
 res.json({data:{selected:ids.length,disabled:count}});
}));
`;
b=change(b,"adminRoutes.patch('/creators/:id'",endpoint+"adminRoutes.patch('/creators/:id'",'backend endpoint');
f=change(f,' const [resetBusy,setResetBusy]=useState(false);',` const [resetBusy,setResetBusy]=useState(false);
 // ${stamp}
 const [selectedIds,setSelectedIds]=useState<string[]>([]);
 const [deleting,setDeleting]=useState(false);`,'frontend state');
const funcs=` const selectedSet=new Set(selectedIds);
 const enabledRows=rows.filter(c=>c.enabled);
 const allVisibleSelected=enabledRows.length>0&&enabledRows.every(c=>selectedSet.has(c.id));
 function selectAllVisible(checked:boolean){
  setSelectedIds(prev=>checked?[...new Set([...prev,...enabledRows.map(c=>c.id)])]:prev.filter(id=>!enabledRows.some(c=>c.id===id)));
 }
 async function disableSelected(){
  if(!csrf||identity?.role!=='owner'||deleting||!selectedIds.length)return;
  const ids=[...new Set(selectedIds)];
  if(!window.confirm('Disable '+ids.length+' selected YouTube creators? Records, metrics and Instagram links will be preserved.'))return;
  setDeleting(true);setError('');setOk('');
  try{
   const result=await api<{selected:number;disabled:number}>('/admin/creators/bulk-disable',{method:'POST',csrf,body:{ids,confirmation:'DISABLE SELECTED'}});
   setOk('Disabled '+result.disabled+' selected creators. Records preserved.');setSelectedIds([]);list.reload();
  }catch(e){setError(errorText(e));}finally{setDeleting(false);}
 }
`;
f=change(f,' function edit(c:Creator)',funcs+' function edit(c:Creator)','frontend handler');
f=change(f,'   <DataBlock loading={list.loading} error={list.error} empty={!rows.length}>',`   {identity?.role==='owner'&&<div className="admin-inline-actions"><label className="admin-check"><input type="checkbox" checked={allVisibleSelected} disabled={!enabledRows.length||deleting} onChange={e=>selectAllVisible(e.target.checked)}/> Select all visible active</label><button type="button" className="btn btn-secondary" disabled={!selectedIds.length||deleting} onClick={disableSelected}>{deleting?'Disabling…':'Delete selected ('+selectedIds.length+')'}</button><button type="button" className="btn btn-secondary" disabled={!selectedIds.length||deleting} onClick={()=>setSelectedIds([])}>Clear selection</button></div>}
   <DataBlock loading={list.loading} error={list.error} empty={!rows.length}>`,'frontend toolbar');
f=change(f,'<thead><tr><th>Creator</th><th>UC ID</th>',`<thead><tr>{identity?.role==='owner'&&<th>Select</th>}<th>Creator</th><th>UC ID</th>`,'table header');
f=change(f,'<tbody>{rows.map(c=><tr key={c.id}><td><strong>{c.display_name}</strong>',`<tbody>{rows.map(c=><tr key={c.id}>{identity?.role==='owner'&&<td><input type="checkbox" aria-label={'Select '+c.display_name} disabled={!c.enabled||deleting} checked={selectedSet.has(c.id)} onChange={e=>setSelectedIds(prev=>e.target.checked?[...new Set([...prev,c.id])]:prev.filter(id=>id!==c.id))}/></td>}<td><strong>{c.display_name}</strong>`,'table rows');
for(const [path,data] of [[backend,b],[frontend,f]]){copyFileSync(path,path+'.before-pci-bulk-delete');writeFileSync(path,data);console.log('Updated '+path)}
console.log('Run npm test/build for Module 1 and typecheck/build for Module 3 before pushing.');
