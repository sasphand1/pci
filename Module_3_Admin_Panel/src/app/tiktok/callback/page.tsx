'use client';
import {Suspense,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {Card,Notice} from '@pci/ui';
import {AdminPage} from '@/components/Shared';
import {api,errorText} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';
function Callback(){
 const params=useSearchParams(),{identity}=useAuth(),sent=useRef(false);
 const [result,setResult]=useState<{ok:boolean;text:string}|null>(null);
 useEffect(()=>{
  if(!identity||sent.current)return;
  sent.current=true;
  const code=params.get('code'),state=params.get('state'),err=params.get('error');
  window.history.replaceState(null,'','/tiktok/callback');
  if(err||!code||!state){setResult({ok:false,text:'TikTok authorization was not completed. Start again from People.'});return;}
  api<{handle:string}>('/admin/tiktok/oauth/exchange',{method:'POST',csrf:identity.csrfToken,body:{code,state},timeoutMs:45000})
   .then(r=>setResult({ok:true,text:r.handle+' connected. Collection is not enabled in this update.'}))
   .catch(e=>setResult({ok:false,text:errorText(e)}));
 },[identity,params]);
 return <AdminPage title="TikTok authorization"><Card>{result?<Notice tone={result.ok?undefined:'danger'}>{result.text}</Notice>:<p role="status">Completing TikTok authorization…</p>}<Link className="btn btn-secondary" href="/bucket">Back to People</Link></Card></AdminPage>;
}
export default function Page(){return <Suspense fallback={null}><Callback/></Suspense>;}
