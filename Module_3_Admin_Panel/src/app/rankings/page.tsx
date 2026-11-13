'use client';
import {useState} from 'react';
import {Card,Notice,Badge} from '@pci/ui';
import {AdminPage,DataBlock,Status,TableWrap,useData,RoleGate} from '@/components/Shared';
import {api,errorText,fmtNum} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';
import type {RankedCreator,Setting} from '@/lib/types';
type Sort='subscribers'|'views'|'videos';
export default function RankingsPage(){
 const {identity}=useAuth();const [sort,setSort]=useState<Sort>('subscribers'),[pending,setPending]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState('');
 const ranking=useData<RankedCreator[]>(`/admin/ranking-preview?sort=${sort}`);const settings=useData<Setting[]>('/admin/settings');
 const current=settings.data?.find(s=>s.key==='ranking_default')?.value;
 const column=sort==='subscribers'?'subscriberCount':sort==='views'?'viewCount':'videoCount';
 const known=ranking.data?.filter(c=>c[column]!==null&&c[column]!==undefined).length??0;
 const missing=(ranking.data?.length??0)-known;
 async function save(){setPending(true);setError('');setOk('');try{await api('/admin/settings',{method:'PATCH',csrf:identity?.csrfToken,body:{key:'ranking_default',value:sort}});setOk('Default ranking updated. Public cache invalidated.');settings.reload();}catch(e){setError(errorText(e));}finally{setPending(false);}}
 return <RoleGate roles={['owner','editor']}><AdminPage title="Ranking engine" description="Transparent raw YouTube metrics with dense ties. No composite influence score is published without additional analytics permission." action={<button className="btn btn-secondary" onClick={ranking.reload}>Reload preview</button>}>
  <Status error={error} ok={ok}/><div className="admin-toolbar"><div className="admin-tools"><div className="field"><label htmlFor="rank-sort">Preview sort</label><select id="rank-sort" value={sort} onChange={e=>setSort(e.target.value as Sort)}><option value="subscribers">Subscribers</option><option value="views">Lifetime views</option><option value="videos">Public video count</option></select></div><div><p className="fineprint">Saved default: <strong>{String(current??'subscribers')}</strong></p></div></div>
   {identity?.role==='owner'&&<button className="btn btn-primary" disabled={pending||sort===current} onClick={save}>{pending?'Saving…':'Make default'}</button>}</div>
  <Notice>Only the selected {sort==='subscribers'?'subscriber':sort==='views'?'lifetime channel view':'video-count'} metric determines this ordering. Available: {known}/{ranking.data?.length??0}; unavailable: {missing}. Equal known counts share a rank. These are not composite influence scores, and apply only to enabled creators in the directory.</Notice>
  <Card><h2 className="admin-box-title">Current preview</h2><DataBlock loading={ranking.loading} error={ranking.error} empty={!ranking.data?.length}>
   <TableWrap><thead><tr><th>Rank</th><th>Creator</th><th>Subscribers</th><th>Views</th><th>Video count</th></tr></thead><tbody>{ranking.data?.map(c=><tr key={c.channelId}><td>{c.rank??'—'}</td><td>{c.displayName}</td><td>{fmtNum(c.subscriberCount)}</td><td>{fmtNum(c.viewCount)}</td><td>{fmtNum(c.videoCount)}</td></tr>)}</tbody></TableWrap>
  </DataBlock></Card><p className="fineprint">Backend uses BigInt-safe numeric ordering. No arithmetic is performed on large counts in the frontend.</p>
 </AdminPage></RoleGate>;
}
