 'use client';
import {useState} from 'react';
import {Card} from '@pci/ui';
import {AdminPage,RoleGate,DataBlock,Status,TableWrap,useData} from '@/components/Shared';
import {api,errorText,fmtNum} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';
type C={instagramCreatorId:string;youtubeCreatorId:string;displayName:string;username:string;eligibility:string;enabled:boolean;curated:boolean;subscriberCount:string|null;viewCount:string|null;followersCount:string|null};
type Score=C&{rank:number;score:number;tiedWith:number;breakdown:{youtubeSubscribers:number;youtubeViews:number;instagramFollowers:number;youtubePlatform:number}};
export default function CrossPlatformAdmin(){
 const {identity}=useAuth(),csrf=identity?.csrfToken;const candidates=useData<C[]>('/admin/cross-platform/candidates');const preview=useData<Score[]>('/admin/cross-platform/preview');const [busy,setBusy]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState('');
 async function setCurated(c:C){setBusy(true);setError('');setOk('');try{await api(`/admin/cross-platform/candidates/${c.instagramCreatorId}`,{method:'PATCH',csrf,body:{curated:!c.curated}});setOk('Curation updated.');candidates.reload();preview.reload();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 return <RoleGate roles={['owner','editor']}><AdminPage title="Unified Top 10 · research engine" description="Curate up to 20 matched, approved YouTube + Instagram people. Experimental scores are NOT publicly enabled without an explicit policy review." action={<button className="btn btn-secondary" onClick={()=>{candidates.reload();preview.reload();}}>Refresh</button>}>
 <Status error={error} ok={ok}/>
 <Card><h2>Curated pool ({candidates.data?.filter(x=>x.curated).length??0}/20)</h2><p className="fineprint">YouTube and Instagram belong to the same verified individual. Missing statistics exclude people from the combined preview; no zero substitution.</p>
 <DataBlock loading={candidates.loading} error={candidates.error} empty={!candidates.data?.length}><TableWrap><thead><tr><th>Person</th><th>Eligibility</th><th>YouTube subscribers</th><th>YouTube views</th><th>Instagram followers</th><th>Curated</th></tr></thead><tbody>{candidates.data?.map(c=><tr key={c.instagramCreatorId}><td>{c.displayName}<p className="fineprint">@{c.username}</p></td><td>{c.eligibility}</td><td>{fmtNum(c.subscriberCount)}</td><td>{fmtNum(c.viewCount)}</td><td>{fmtNum(c.followersCount)}</td><td><button className="btn btn-secondary" disabled={busy||(!c.curated&&(c.eligibility!=='approved'||!c.enabled))} onClick={()=>setCurated(c)}>{c.curated?'Remove':'Include'}</button></td></tr>)}</tbody></TableWrap></DataBlock></Card>
 <Card><h2>Unified Top 10 preview</h2><p className="fineprint">Exact tied scores share a rank. Scores: 25% YouTube subscribers, 25% YouTube views, 50% Instagram followers, evaluated as within-cohort normalized standings.</p>
 <DataBlock loading={preview.loading} error={preview.error} empty={!preview.data?.length}><TableWrap><thead><tr><th>Rank</th><th>Creator</th><th>Score / 100</th><th>YouTube contribution</th><th>Instagram contribution</th><th>Tie</th></tr></thead><tbody>{preview.data?.map(c=><tr key={c.instagramCreatorId}><td>#{c.rank}</td><td>{c.displayName}</td><td>{c.score.toFixed(2)}</td><td>{(c.breakdown.youtubePlatform/2).toFixed(2)}</td><td>{(c.breakdown.instagramFollowers/2).toFixed(2)}</td><td>{c.tiedWith>1?`${c.tiedWith} share rank`: '—'}</td></tr>)}</tbody></TableWrap></DataBlock></Card>
 </AdminPage></RoleGate>;
}
