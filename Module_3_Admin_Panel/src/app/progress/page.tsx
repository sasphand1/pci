'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Card,Notice} from '@pci/ui';
import {AdminPage} from '@/components/Shared';
import {useAuth} from '@/components/AuthProvider';
import {api,ApiError,errorText,fmtDate} from '@/lib/api';

/** Progress boards: static board files in public/progress-board/<slug>/ (listed in projects.json).
 * The shared state lives in Module 1 (/admin/progress/:slug): every admin sees it, owners and editors change it,
 * and saving is versioned so two people never overwrite each other silently. */
type Project={slug:string;title:string;description:string};
type BoardState={items:Record<string,{status:string;note?:string}>;texts:Record<string,string>;notes:unknown[];arrows:{st?:string}[]};
type Board={slug:string;state:BoardState|null;version:number;updatedAt:string|null;updatedBy:string|null};
type Counts={done:number;doing:number;missing:number;total:number};
const BASE='/progress-board';
const SLUG=/^[a-z0-9-]{2,60}$/;
const SAVE_DELAY=1200,POLL=30000;

function countStatus(defaults:unknown,saved:BoardState|null):Counts|null{
 const d=(defaults&&typeof defaults==='object'?defaults:{}) as Partial<BoardState>;
 const items={...(d.items??{}),...(saved?.items??{})};
 const arrows=saved?saved.arrows:(Array.isArray(d.arrows)?d.arrows:[]);
 const all=[...Object.values(items).map(i=>i?.status),...arrows.map(a=>a?.st)];
 if(!all.length)return null;
 return {done:all.filter(s=>s==='g').length,doing:all.filter(s=>s==='a').length,missing:all.filter(s=>s==='r').length,total:all.length};
}

export default function ProgressPage(){
 const {identity}=useAuth();
 const csrf=identity?.csrfToken;
 const canEdit=identity?.role==='owner'||identity?.role==='editor';
 const [projects,setProjects]=useState<Project[]>([]);
 const [active,setActive]=useState('');
 const [counts,setCounts]=useState<Record<string,Counts|null>>({});
 const [board,setBoard]=useState<Board|null>(null);
 const [saving,setSaving]=useState<'idle'|'pending'|'saving'|'saved'>('idle');
 const [error,setError]=useState(''),[info,setInfo]=useState('');
 const frame=useRef<HTMLIFrameElement>(null);
 const boardRef=useRef<Board|null>(null);
 const pending=useRef<BoardState|null>(null);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const defaults=useRef<Record<string,unknown>>({});

 const send=useCallback((state:BoardState|null)=>{frame.current?.contentWindow?.postMessage({type:'pci-board-load',state},window.location.origin);},[]);
 const adopt=useCallback((b:Board)=>{boardRef.current=b;setBoard(b);setCounts(c=>({...c,[b.slug]:countStatus(defaults.current[b.slug],b.state)}));},[]);

 // Project list and the summary on each card.
 useEffect(()=>{
  if(!identity)return;let live=true;
  (async()=>{
   try{
    const res=await fetch(`${BASE}/projects.json`,{cache:'no-store'});if(!res.ok)throw new Error('missing');
    const json=await res.json() as {projects?:Project[]};
    const list=(Array.isArray(json.projects)?json.projects:[]).filter(p=>p&&typeof p.slug==='string'&&SLUG.test(p.slug));
    if(!live)return;setProjects(list);setActive(a=>a||list[0]?.slug||'');
    const entries=await Promise.all(list.map(async p=>{
     try{const r=await fetch(`${BASE}/${p.slug}/status.json`,{cache:'no-store'});defaults.current[p.slug]=r.ok?await r.json():{};}catch{defaults.current[p.slug]={};}
     let saved:BoardState|null=null;try{saved=(await api<Board>(`/admin/progress/${p.slug}`,{background:true})).state;}catch{/* API not deployed yet: defaults only */}
     return [p.slug,countStatus(defaults.current[p.slug],saved)] as const;
    }));
    if(live)setCounts(Object.fromEntries(entries));
   }catch{if(live)setError('No progress boards are published yet.');}
  })();
  return()=>{live=false;};
 },[identity?.id]);

 // Load the active board from Module 1.
 const load=useCallback(async(slug:string,quiet=false)=>{
  try{const b=await api<Board>(`/admin/progress/${slug}`,{background:quiet});
   if(pending.current)return;
   if(!quiet||!boardRef.current||b.version!==boardRef.current.version){adopt(b);send(b.state);if(quiet&&boardRef.current)setInfo(`Updated with changes saved by ${b.updatedBy??'another admin'}.`);}
  }catch(e){if(!quiet)setError(e instanceof ApiError&&e.status===404?'Saving is not available until Module 1 is updated. The board shows its default statuses.':errorText(e));}
 },[adopt,send]);

 const save=useCallback(async()=>{
  const state=pending.current,b=boardRef.current;if(!state||!b||!canEdit)return;
  pending.current=null;setSaving('saving');setError('');
  try{const next=await api<Board>(`/admin/progress/${b.slug}`,{method:'PUT',csrf,body:{version:b.version,state}});adopt(next);setSaving('saved');}
  catch(e){
   if(e instanceof ApiError&&e.status===409){setInfo('Someone else saved this board at the same time. Their version is loaded; please redo your last change.');setSaving('idle');await load(b.slug);}
   else{pending.current=state;setSaving('pending');setError(`Not saved: ${errorText(e)}`);}
  }
 },[adopt,canEdit,csrf,load]);

 // Messages from the board (same origin, this page's own iframe only).
 useEffect(()=>{
  function onMessage(e:MessageEvent){
   if(e.origin!==window.location.origin||e.source!==frame.current?.contentWindow)return;
   const m=e.data as {type?:string;state?:BoardState};
   if(m?.type==='pci-board-ready'){if(boardRef.current?.slug===active)send(boardRef.current.state);else void load(active);}
   if(m?.type==='pci-board-change'&&canEdit&&m.state){
    pending.current=m.state;setSaving('pending');setInfo('');
    if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>void save(),SAVE_DELAY);
   }
  }
  window.addEventListener('message',onMessage);return()=>window.removeEventListener('message',onMessage);
 },[active,canEdit,load,save,send]);

 // Switching boards: save what is pending, then forget the old one.
 useEffect(()=>{
  if(timer.current){clearTimeout(timer.current);timer.current=null;}
  if(pending.current)void save();
  boardRef.current=null;setBoard(null);setSaving('idle');setInfo('');setError('');
 },[active]);

 // See teammates' changes without reloading the page.
 useEffect(()=>{if(!active)return;const t=setInterval(()=>{if(!pending.current)void load(active,true);},POLL);return()=>clearInterval(t);},[active,load]);

 const current=projects.find(p=>p.slug===active);
 const status=saving==='saving'?'Saving…':saving==='pending'?'Unsaved changes…':board?.updatedAt?`Saved ${fmtDate(board.updatedAt)}${board.updatedBy?` by ${board.updatedBy}`:''}`:'Default statuses (not edited yet)';
 return <AdminPage title="Progress" description="Architecture and build progress for each PCI project. Everyone on the team sees the same board; owners and editors can update it.">
  {error&&<Notice tone="danger">{error}</Notice>}
  {info&&<Notice>{info}</Notice>}
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
    <span className={`progress-save progress-save-${saving}`} role="status">{status}</span>
   </div>
   <iframe ref={frame} key={current.slug} className="progress-frame" src={`${BASE}/${current.slug}/index.html?embed=1${canEdit?'':'&view=1'}`} title={`${current.title} progress board`}/>
   <p className="admin-stat-note">{canEdit?'Click a shape, arrow or card to set its status and note. Edit text, + Text and + Arrow add your own content; Undo (Ctrl+Z) reverts. Changes save automatically for the whole team. PNG and SVG save a picture of the board.':'Read-only for your role. PNG and SVG save a picture of the board.'}</p>
  </Card>}
 </AdminPage>;
}
