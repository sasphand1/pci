'use client';
import {useEffect,useState} from 'react';
import {Card,Notice} from '@pci/ui';
import {AdminPage} from '@/components/Shared';
import {useAuth} from '@/components/AuthProvider';

/** Progress boards are static files in public/progress-board/<slug>/ (index.html + status.json),
 * listed in public/progress-board/projects.json. Every administrator sees the same shared board. */
type Project={slug:string;title:string;description:string};
type Counts={done:number;doing:number;missing:number;total:number};
const BASE='/progress-board';
const SLUG=/^[a-z0-9-]{2,60}$/;

function countStatus(raw:unknown):Counts|null{
 if(!raw||typeof raw!=='object')return null;
 const r=raw as {items?:Record<string,{status?:string}>;arrows?:{st?:string}[]};
 const all=[...Object.values(r.items??{}).map(i=>i?.status),...(Array.isArray(r.arrows)?r.arrows.map(a=>a?.st):[])];
 if(!all.length)return null;
 return {done:all.filter(s=>s==='g').length,doing:all.filter(s=>s==='a').length,missing:all.filter(s=>s==='r').length,total:all.length};
}

export default function ProgressPage(){
 const {identity}=useAuth();
 const canEdit=identity?.role==='owner'||identity?.role==='editor';
 const [projects,setProjects]=useState<Project[]>([]);
 const [active,setActive]=useState('');
 const [counts,setCounts]=useState<Record<string,Counts|null>>({});
 const [error,setError]=useState('');

 useEffect(()=>{
  let live=true;
  (async()=>{
   try{
    const res=await fetch(`${BASE}/projects.json`,{cache:'no-store'});
    if(!res.ok)throw new Error('missing');
    const json=await res.json() as {projects?:Project[]};
    const list=(Array.isArray(json.projects)?json.projects:[]).filter(p=>p&&typeof p.slug==='string'&&SLUG.test(p.slug));
    if(!live)return;
    setProjects(list);setActive(a=>a||list[0]?.slug||'');
    const entries=await Promise.all(list.map(async p=>{
     try{const r=await fetch(`${BASE}/${p.slug}/status.json`,{cache:'no-store'});return [p.slug,r.ok?countStatus(await r.json()):null] as const;}
     catch{return [p.slug,null] as const;}
    }));
    if(live)setCounts(Object.fromEntries(entries));
   }catch{if(live)setError('No progress boards are published yet.');}
  })();
  return()=>{live=false;};
 },[]);

 const current=projects.find(p=>p.slug===active);
 return <AdminPage title="Progress" description="Architecture and build progress for each PCI project. Every administrator sees the same shared board.">
  {error&&<Notice tone="warning">{error}</Notice>}
  <div className="progress-projects">
   {projects.map(p=>{const c=counts[p.slug];const pct=c&&c.total?Math.round(c.done/c.total*100):null;
    return <button key={p.slug} type="button" className={`progress-project${p.slug===active?' is-active':''}`} aria-pressed={p.slug===active} onClick={()=>setActive(p.slug)}>
     <span className="progress-project-title">{p.title}</span>
     <span className="progress-project-desc">{p.description}</span>
     {c&&<progress value={c.done} max={c.total} aria-label={`${pct}% done`}/>}
     <span className="progress-project-stats">{c?`${pct}% done · ${c.doing} in progress · ${c.missing} missing`:'Status not published yet'}</span>
    </button>;})}
  </div>
  {current&&<Card>
   <div className="progress-board-head">
    <h2>{current.title}</h2>
    {canEdit&&<a className="btn btn-secondary" href={`${BASE}/${current.slug}/index.html`} target="_blank" rel="noopener noreferrer">Open editor</a>}
   </div>
   <iframe key={current.slug} className="progress-frame" src={`${BASE}/${current.slug}/index.html?view=1`} title={`${current.title} progress board`}/>
   {canEdit&&<p className="admin-stat-note">To publish an update: Open editor, change the board, click Export, then replace public/progress-board/{current.slug}/status.json in the repository and deploy. Everyone sees it after the deploy.</p>}
  </Card>}
 </AdminPage>;
}
