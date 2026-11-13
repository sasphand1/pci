'use client';
import {useState} from 'react';
import {Card,Badge} from '@pci/ui';
import {AdminPage,DataBlock,Status,TableWrap,useData,RoleGate} from '@/components/Shared';
import {api,errorText,fmtDate,fmtNum} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';
import type {Video} from '@/lib/types';
export default function VideosPage(){
 const {identity}=useAuth();const {data,error,loading,reload}=useData<Video[]>('/admin/videos?limit=100');
 const [pending,setPending]=useState<string|null>(null),[writeError,setWriteError]=useState(''),[ok,setOk]=useState('');
 async function toggle(v:Video){setPending(v.video_id);setWriteError('');setOk('');try{await api(`/admin/videos/${v.video_id}`,{method:'PATCH',csrf:identity?.csrfToken,body:{displayOnSite:!v.display_on_site}});setOk(`Visibility updated for ${v.title}.`);reload();}catch(e){setWriteError(errorText(e));}finally{setPending(null);}}
 return <RoleGate roles={['owner','editor']}><AdminPage title="Video catalogue" description="Inspect the latest fetched videos and control whether each is shown on the public site." action={<button className="btn btn-secondary" onClick={reload}>Reload</button>}><Status error={writeError} ok={ok}/>
  <Card><DataBlock loading={loading} error={error} empty={!data?.length}><TableWrap><thead><tr><th>Video</th><th>Creator</th><th>Published</th><th>Views</th><th>Public</th><th>Action</th></tr></thead><tbody>{data?.map(v=><tr key={v.video_id}><td className="admin-trunc"><a href={`https://www.youtube.com/watch?v=${encodeURIComponent(v.video_id)}`} target="_blank" rel="noopener noreferrer">{v.title}</a></td><td>{v.display_name}</td><td>{fmtDate(v.published_at)}</td><td>{fmtNum(v.views)}</td><td><Badge variant={v.display_on_site?'normal':'danger'}>{v.display_on_site?'Shown':'Hidden'}</Badge></td><td><button className="btn btn-secondary" disabled={pending===v.video_id} onClick={()=>toggle(v)}>{pending===v.video_id?'Updating…':v.display_on_site?'Hide':'Show'}</button></td></tr>)}</tbody></TableWrap></DataBlock></Card>
 </AdminPage></RoleGate>;
}
