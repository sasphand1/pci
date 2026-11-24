'use client';
import {useEffect,useState} from 'react';
import {adapterPublicUrl} from '@/lib/client-api';
import Link from 'next/link';
import {formatCount,safeCreatorImage} from '@/lib/format.mjs';
import {SCOPE_PATTERN,type PubRanking} from '@/lib/public';

const choices=[{scope:'wheel.subscribed',label:'Most Subscribed'},{scope:'wheel.viewed',label:'Most Viewed'},{scope:'wheel.active',label:'Most Active'},{scope:'youtube.subscribed',label:'YouTube'},{scope:'instagram.followers',label:'Instagram'}];

/** The Top 100. The three wheel sorts arrive with the page; the others are fetched when chosen. */
export function PublishedTop100({initial,categories}:{initial:Record<string,PubRanking|null>;categories:{slug:string;label:string}[]}){
 const [scope,setScope]=useState('wheel.subscribed');
 const [loaded,setLoaded]=useState<Record<string,PubRanking|null>>(initial);
 const [loading,setLoading]=useState(false);
 const [reloadingPictures,setReloadingPictures]=useState(false);
 const [pictureError,setPictureError]=useState('');
 async function reloadPictures(){
  if(!SCOPE_PATTERN.test(scope))return;
  setReloadingPictures(true);setPictureError('');
  try{
   const response=await fetch(`${adapterPublicUrl}/api/v1/public/rankings/${scope}?limit=100`,{cache:'no-store'});
   if(!response.ok)throw new Error('Ranking not available');
   const parsed=await response.json();
   setLoaded(previous=>({...previous,[scope]:parsed.data??null}));
  }catch{setPictureError('Pictures could not be reloaded. Please retry.');}
  finally{setReloadingPictures(false);}
 }
 useEffect(()=>{
  if(scope in loaded||!SCOPE_PATTERN.test(scope))return;
  let canceled=false;setLoading(true);
  fetch(`${adapterPublicUrl}/api/v1/public/rankings/${scope}?limit=100`,{cache:'no-store'})
   .then(r=>r.ok?r.json():Promise.reject(new Error('unavailable')))
   .then(j=>{if(!canceled)setLoaded(old=>({...old,[scope]:j.data??null}));})
   .catch(()=>{if(!canceled)setLoaded(old=>({...old,[scope]:null}));})
   .finally(()=>{if(!canceled)setLoading(false);});
  return()=>{canceled=true;};
 },[scope,loaded]);
 const ranking=loaded[scope]??null;
 const rows=ranking?.entries??[];
 const [shown,setShown]=useState(10);
 useEffect(()=>{setShown(10);},[scope]);
 const pill=(on:boolean)=>`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${on?'border-primary bg-primary text-primary-foreground':'border-border bg-card text-muted-foreground hover:text-foreground'}`;
 return <section className="content-card p-4 sm:p-6">
  <h2 className="font-display text-2xl text-primary">Top 100 Creators</h2>
  <p className="mt-1 text-sm text-muted-foreground">Pick a ranking. Every list shows only what was published after passing the checks.</p>
  <button type="button" className="mt-2 rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground" disabled={reloadingPictures} onClick={()=>void reloadPictures()}>{reloadingPictures?'Reloading pictures…':'Reload pictures'}</button>
  {pictureError&&<p role="alert" className="mt-1 text-xs text-destructive">{pictureError}</p>}
  <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Choose ranking">{choices.map(c=><button type="button" key={c.scope} className={pill(scope===c.scope)} aria-pressed={scope===c.scope} onClick={()=>setScope(c.scope)}>{c.label}</button>)}
   {categories.length>0&&<select className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground" aria-label="Category ranking" value={scope.startsWith('category.')?scope:''} onChange={e=>{if(e.target.value)setScope(e.target.value);}}><option value="">Category…</option>{categories.map(c=><option key={c.slug} value={`category.${c.slug}`}>{c.label}</option>)}</select>}</div>
  {loading?<p className="mt-6 text-sm text-muted-foreground">Loading…</p>
   :!ranking||!ranking.publishedAt?<p className="mt-6 text-sm text-muted-foreground">This ranking has not been published yet.</p>
   :!rows.length?<p className="mt-6 text-sm text-muted-foreground">Nobody has a fresh number for this ranking yet.</p>
   :<>
    <ol className="mt-4 divide-y divide-border/70 overflow-hidden rounded-xl border border-border/80">
     {rows.slice(0,shown).map(e=>{const img=safeCreatorImage(e.person.avatarUrl);return <li key={e.person.slug}>
      <Link href={`/creators/${encodeURIComponent(e.person.slug)}`} className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-muted/60">
       <span className="w-8 shrink-0 text-sm font-bold text-primary">{e.tied?'=':''}{e.rank}</span>
       {img?<img className="h-9 w-9 shrink-0 rounded-full object-cover" alt="" src={img} referrerPolicy="no-referrer"/>:<span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">{e.person.displayName.slice(0,1)}</span>}
       <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-foreground">{e.person.displayName}</strong><small className="block truncate text-xs text-muted-foreground">{e.person.categories.map(c=>c.label).join(', ')}</small></span>
       <span className="shrink-0 text-right text-sm font-semibold text-foreground">{formatCount(e.value,true)}<small className="block text-[10px] font-normal text-muted-foreground">{ranking.unit}</small></span>
      </Link>
     </li>;})}
    </ol>
    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
     <span>Showing {Math.min(shown,rows.length)} of {rows.length}</span>
     <span className="flex gap-2">{shown<rows.length&&<button type="button" className="rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground" onClick={()=>setShown(n=>Math.min(n+10,rows.length))}>Show 10 more</button>}{shown>10&&<button type="button" className="rounded-full border border-border px-4 py-2 font-semibold" onClick={()=>setShown(10)}>Collapse</button>}</span>
    </div>
   </>}
  <p className="mt-4 text-xs leading-5 text-muted-foreground">Counts are the ones YouTube and Instagram report, added across a person&apos;s accounts. They are not unique people and followers may overlap. {ranking?.publishedAt?`Published ${new Date(ranking.publishedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})}.`:''}</p>
 </section>;
}
