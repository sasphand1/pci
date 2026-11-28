'use client';
import {useState} from 'react';
import {api,errorText} from '@/lib/api';
type Match={slug:string;name:string;accounts:{platform:string;handle:string;reason:string}[]};
type Plan={id:string;handle:string;name:string;kind:'existing'|'new'|'ambiguous';personSlug:string|null;linked:string|null;matches:Match[];repair:boolean;ready:boolean;hubReady:boolean;token:string;registered:boolean};
type Scope={scope:string;status:string;population:number;covered:number;gateFailures:{gate:string;message:string}[]};
type Batch={batchId:string;scopes:Scope[]};
const base='/admin/bucket/scrappa';
export default function TikTokIdentityWizard({csrf,onChange}:{csrf?:string;onChange:()=>Promise<void>}){
 const [step,setStep]=useState(0),[plan,setPlan]=useState<Plan[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[batch,setBatch]=useState<Batch|null>(null);
 const [result,setResult]=useState<{published:string[];rejected:{scope:string}[]}|null>(null);
 const post=<T,>(path:string,body?:unknown)=>api<T>(path,{method:'POST',body,csrf,timeoutMs:120000});
 async function run(f:()=>Promise<void>){setBusy(true);setMessage('');try{await f();}catch(e){setMessage(errorText(e));}finally{setBusy(false);}}
 async function review(){const p=await api<Plan[]>(base+'/registry-plan',{timeoutMs:120000});setPlan(p);setBatch(null);setResult(null);setStep(1);}
 const blocked=plan.filter(p=>!p.ready||p.kind==='ambiguous');
 const changes=plan.filter(p=>!p.registered||p.repair);
 const complete=plan.length>0&&plan.every(p=>p.hubReady&&!p.repair&&p.kind!=='ambiguous');
 const followers=batch?.scopes.find(s=>s.scope==='tiktok.followers');
 const canPublish=complete&&Boolean(followers&&followers.status==='draft'&&!followers.gateFailures.length&&followers.population===plan.length&&followers.covered===plan.length&&batch?.scopes.filter(s=>!s.scope.startsWith('tiktok.')).every(s=>s.status==='draft'&&!s.gateFailures.length));
 async function assign(){
  if(blocked.length||!plan.length)return;
  if(changes.length){
   if(!window.confirm('Confirm the suggested accounts belong to the same creators, and approve their data for central publication? Temporary duplicates without published history may be consolidated.'))return;
   const r=await post<{assigned:number;plan:Plan[]}>(base+'/registry-apply',{items:changes.map(p=>({id:p.id,token:p.token})),confirm:true});
   setPlan(r.plan);setMessage(`${r.assigned} identities assigned. No API credits used.`);await onChange();
  }
  setStep(2);
 }
 async function rank(){
  if(!complete)return;
  const r=await post<{batchId:string}>('/admin/rank');
  setBatch(await api<Batch>('/admin/rank/'+r.batchId,{timeoutMs:120000}));setStep(3);
 }
 async function recover(){
  const b=await api<Batch|null>('/admin/rank/latest',{timeoutMs:120000});
  if(!b||!b.scopes.some(s=>s.scope==='tiktok.followers'&&s.status==='draft')){setMessage('No current TikTok draft found. Build drafts when the previous request has finished.');return;}
  setBatch(b);setStep(3);
 }
 async function publish(){
  if(!canPublish||!batch)return;
  if(!window.confirm('Publish passing rankings? Rankings without enough sample data remain blocked.'))return;
  setResult(await post<{published:string[];rejected:{scope:string}[]}>('/admin/rank/'+batch.batchId+'/publish'));setStep(4);
 }
 return <section aria-label="Guided TikTok setup"><h3>Guided TikTok setup</h3><p className="fineprint">Review → assign → rank → publish. Uses existing observations, not API credits. Similar usernames require owner verification.</p><p role="status">{busy?'Working…':message}</p>
 {step===0&&<button className="btn btn-primary" disabled={busy} onClick={()=>void run(review)}>Start setup</button>}
 {step===1&&<><h4>1. Review suggested identities</h4><p>Existing published creators are included automatically. Confirm the proposed links; ambiguous matches stay blocked.</p>
 {plan.map(p=><p key={p.id}><strong>{p.name}</strong> (@{p.handle}) — {!p.ready?'Recent verified profile required':p.kind==='ambiguous'?'Ambiguous — individual review required':p.repair?'Consolidate into '+p.personSlug:p.kind==='new'?'Create unique People identity':p.registered?'Already linked: '+p.linked:'Link to '+p.personSlug}{p.matches.length>0&&<span className="fineprint"> · {p.matches.map(m=>m.slug+': '+m.accounts.map(a=>a.platform+' @'+a.handle+' ('+a.reason+')').join(', ')).join('; ')}</span>}</p>)}
 <button className="btn btn-primary" disabled={busy||blocked.length>0||!plan.length} onClick={()=>void run(assign)}>Next: assign {changes.length} identities</button> <button className="btn btn-secondary" disabled={busy} onClick={()=>void run(review)}>Refresh review</button></>}
 {step===2&&<><h4>2. Identity assignments</h4><p>{plan.filter(p=>p.hubReady).length} of {plan.length} creators ready for central publication.</p><button className="btn btn-primary" disabled={busy||!complete} onClick={()=>void run(rank)}>Next: build drafts</button> <button className="btn btn-secondary" disabled={busy||!complete} onClick={()=>void run(recover)}>Check existing drafts</button> <button className="btn btn-secondary" disabled={busy} onClick={()=>void run(review)}>Review again</button></>}
 {step===3&&batch&&<><h4>3. Ranking checks</h4>{batch.scopes.map(s=><p key={s.scope}>{s.scope}: {s.covered}/{s.population} — {s.gateFailures.length?s.gateFailures.map(g=>g.message).join('; '):s.status==='draft'?'Passed':s.status}</p>)}<button className="btn btn-primary" disabled={busy||!canPublish} onClick={()=>void run(publish)}>Next: publish passing rankings</button> <button className="btn btn-secondary" disabled={busy} onClick={()=>void run(review)}>Start review again</button>{!canPublish&&<p className="fineprint">Publication is blocked until the full TikTok followers cohort and existing ranking gates pass.</p>}</>}
 {step===4&&result&&<><h4>4. Publication complete</h4><p>{result.published.length} scopes published. {result.rejected.length} blocked by safety gates.</p><p>{result.published.includes('tiktok.followers')?'Central followers published. Verify the live cohort before enabling active mode in Hostinger.':'TikTok followers did not publish; keep preparation mode enabled.'}</p><button className="btn btn-secondary" disabled={busy} onClick={()=>void run(review)}>Review again</button></>}
 </section>;
}
