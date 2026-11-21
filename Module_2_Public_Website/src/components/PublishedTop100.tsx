'use client';
import {useEffect,useState} from 'react';
import {adapterPublicUrl} from '@/lib/client-api';
import {RankingTable} from '@/components/RankingTable';
import {SCOPE_PATTERN,type PubRanking} from '@/lib/public';

const choices=[{scope:'wheel.subscribed',label:'Most Subscribed'},{scope:'wheel.viewed',label:'Most Viewed'},{scope:'wheel.active',label:'Most Active'},{scope:'youtube.subscribed',label:'YouTube'},{scope:'instagram.followers',label:'Instagram'}];

/** The Top 100. The three wheel sorts arrive with the page; the others are fetched when chosen. */
export function PublishedTop100({initial,categories}:{initial:Record<string,PubRanking|null>;categories:{slug:string;label:string}[]}){
 const [scope,setScope]=useState('wheel.subscribed');
 const [loaded,setLoaded]=useState<Record<string,PubRanking|null>>(initial);
 const [loading,setLoading]=useState(false);
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
 return <section className="section pci-unified-top"><div className="pci-unified-head"><div><h2>Top 100 Creators</h2><p className="muted">Pick a ranking. Every list shows only what was published after passing the checks.</p></div></div>
  <div className="pci-unified-filters" aria-label="Choose ranking">{choices.map(c=><button type="button" key={c.scope} className={`btn ${scope===c.scope?'btn-primary':'btn-secondary'}`} aria-pressed={scope===c.scope} onClick={()=>setScope(c.scope)}>{c.label}</button>)}
   {categories.length>0&&<select aria-label="Category ranking" value={scope.startsWith('category.')?scope:''} onChange={e=>{if(e.target.value)setScope(e.target.value);}}><option value="">Category…</option>{categories.map(c=><option key={c.slug} value={`category.${c.slug}`}>{c.label}</option>)}</select>}</div>
  {loading?<p className="muted pci-unified-empty">Loading…</p>:<RankingTable ranking={ranking}/>}
  <p className="fineprint">Counts are the ones YouTube and Instagram report, added across a person&apos;s accounts. They are not unique people and followers may overlap. {ranking?.publishedAt?`Published ${new Date(ranking.publishedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})}.`:''}</p>
 </section>;
}
