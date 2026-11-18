'use client';
import {useState} from 'react';
import {Card} from '@pci/ui';
import {AdminPage,RoleGate,Status,DataBlock,TableWrap,useData} from '@/components/Shared';
import {api,errorText} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';
type Person={id:string;displayName:string;channelId:string;humanReviewStatus:'pending'|'approved'|'rejected';enabled:boolean;categoryIds:string[]};
type Category={id:string;label:string;slug:string};
export default function UnifiedReview(){
 const {identity}=useAuth(),csrf=identity?.csrfToken;
 const people=useData<Person[]>('/admin/unified/creators');const categories=useData<Category[]>('/admin/categories');
 const [search,setSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState('');
 async function action(work:()=>Promise<unknown>,message:string){setBusy(true);setError('');setOk('');try{await work();setOk(message);people.reload();}catch(e){setError(errorText(e));}finally{setBusy(false)}}
 async function review(p:Person,decision:'approved'|'rejected'|'pending'){
  if(decision==='approved'&&!window.confirm(`I have verified that ${p.displayName} is one real individual human YouTuber, not a business, brand, production house, institution, team or generic channel. Approve?`))return;
  await action(()=>api(`/admin/unified/creators/${p.id}/review`,{method:'PATCH',csrf,body:{decision,humanConfirmed:decision==='approved'}}),`Human eligibility set to ${decision}.`);
 }
 async function updateCategories(p:Person,categoryId:string,checked:boolean){
  const categoryIds=checked?[...new Set([...p.categoryIds,categoryId])]:p.categoryIds.filter(id=>id!==categoryId);
  await action(()=>api(`/admin/creators/${p.id}`,{method:'PATCH',csrf,body:{categoryIds}}),'Category updated for this person across linked accounts.');
 }
 const visible=(people.data??[]).filter(p=>`${p.displayName} ${p.channelId}`.toLowerCase().includes(search.toLowerCase()));
 return <RoleGate roles={['owner','editor']}><AdminPage title="Unified human creators" description="One identity per human YouTuber. Verify eligibility and assign shared editorial categories. The original YouTube and Instagram registration screens remain available." action={<button className="btn btn-secondary" onClick={()=>people.reload()}>Reload</button>}>
 <Status error={error} ok={ok}/><Card><p className="muted">Only manually approved individuals qualify for the unified Top 20 wheel and Top 100 table. Organizations and generic channels remain stored in YouTube but excluded from human rankings.</p>
 <div className="field"><label htmlFor="pci-unified-search">Find person</label><input id="pci-unified-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name or YouTube channel ID"/></div>
 <DataBlock loading={people.loading} error={people.error} empty={!visible.length}><TableWrap><thead><tr><th>Creator</th><th>Human review</th><th>Shared categories</th><th>Actions</th></tr></thead>
 <tbody>{visible.map(p=><tr key={p.id}><td><strong>{p.displayName}</strong><p className="fineprint">{p.channelId}</p></td><td>{p.humanReviewStatus}</td><td><div className="pci-unified-checks">{(categories.data??[]).map(c=><label key={c.id} className="fineprint"><input type="checkbox" disabled={busy} checked={p.categoryIds.includes(c.id)} onChange={e=>updateCategories(p,c.id,e.target.checked)}/> {c.label}</label>)}</div></td>
 <td><div className="admin-inline-actions"><button className="btn btn-secondary" disabled={busy} onClick={()=>review(p,'approved')}>Approve human</button><button className="btn btn-secondary" disabled={busy} onClick={()=>review(p,'rejected')}>Reject</button><button className="btn btn-secondary" disabled={busy} onClick={()=>review(p,'pending')}>Reset</button></div></td></tr>)}</tbody></TableWrap></DataBlock>
 </Card></AdminPage></RoleGate>;
}
