'use client';
import {useState} from 'react';
import {api,errorText} from '@/lib/api';

type DirectorySource={id:string;name:string;category:string;url:string;mode:'structured_feed'|'official_announcements'|'calendar_support'|'discovery_only';note:string};
type Lead={title:string;url:string;category:string;provider:string;is_event:false};
type Result={items:Lead[];category:string;status:'ready'|'unavailable';warning:string;checked_at:string};
const NAMES:Record<string,string>={sports:'Sports',education:'Education',gaming:'Gaming',technology:'Technology',business:'Business',arts:'Arts',community:'Community',fashion:'Fashion',health:'Medical & Health',food:'Food & Dining'};
export function EventsSourcesDiscovery(){
 const [sources,setSources]=useState<DirectorySource[]>([]),[category,setCategory]=useState('fashion'),[leads,setLeads]=useState<Result|null>(null);
 const [error,setError]=useState(''),[loading,setLoading]=useState(false),[loaded,setLoaded]=useState(false);
 async function loadDirectory(){setLoading(true);setError('');try{setSources(await api<DirectorySource[]>('/admin/events/intelligence/directory'));setLoaded(true);}catch(e){setError(errorText(e));}finally{setLoading(false);}}
 async function discover(){setLoading(true);setError('');setLeads(null);try{setLeads(await api<Result>('/admin/events/intelligence/discover?category='+encodeURIComponent(category),{timeoutMs:12000}));}catch(e){setError(errorText(e));}finally{setLoading(false);}}
 return <section className="pci-ei-section" aria-label="Official source discovery and Google News leads">
  <div className="pci-ei-heading"><div><h2>Official sources and public feeds</h2><p className="muted">Government, fashion, healthcare, food, sports and university sources. No unofficial scraping or fabricated dates.</p></div><button type="button" className="btn btn-secondary" disabled={loading} onClick={()=>void loadDirectory()}>{loaded?'Refresh directory':'Load source directory'}</button></div>
  {error&&<p role="alert" className="pci-ei-error">{error}</p>}
  {loaded&&<div className="pci-ei-source-directory">{sources.map(s=><article key={s.id} className="admin-setting-card"><strong>{s.name}</strong><small>{NAMES[s.category]||s.category} · {s.mode==='structured_feed'?'Structured feed':s.mode==='calendar_support'?'Public ICS calendars':s.mode==='discovery_only'?'Discovery only':'Official announcements'}</small><p>{s.note}</p><a target="_blank" rel="noopener noreferrer" href={s.url}>Open official source</a></article>)}</div>}
  <div className="pci-ei-heading pci-ei-discovery-head"><div><h2>Google News — discovery leads</h2><p className="muted">Articles are not event schedules. Check an organizer's actual event date and venue before publishing in Event sources.</p></div></div>
  <div className="pci-ei-filters"><label>Find leads in category<select value={category} onChange={e=>setCategory(e.target.value)}>{Object.entries(NAMES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><button type="button" className="btn btn-primary" disabled={loading} onClick={()=>void discover()}>{loading?'Checking…':'Discover articles'}</button></div>
  {leads&&<><p role="status" className="fineprint">{leads.status==='ready'?`${leads.items.length} discovery leads (not imported events)`: 'Google News feed unavailable; the existing Events system is unaffected.'} {leads.warning}</p>
   <div className="pci-ei-leads">{leads.items.map((item,i)=><article key={item.url+'-'+i}><span>{i+1}.</span><strong>{item.title}</strong><a href={item.url} target="_blank" rel="noopener noreferrer">Read article</a></article>)}</div></>}
  <p className="fineprint">Automatic source imports: add public organizer JSON, RSS or ICS URLs under <a href="/events/sources">Event sources</a>. Every source is disabled until you verify reuse rights. Announcements and Google News are not direct event APIs.</p>
 </section>;
}
