'use client';
import {useMemo,useState,useRef,useEffect} from 'react';
import {Wind,Car,School,Coins,Satellite,ArrowUpRight,Bell,Radio,ChevronLeft,ChevronRight,Leaf,Globe2,X} from 'lucide-react';
import {qrSvgPath} from '@/lib/qr';

export type SatifyValue={id:string;label:string;unit:string;value:number|null;text:string|null;badge:'measured'|'official'|'forecast'|'estimate';source:string;observedAt:string;sourceUrl:string|null};
export type SatifyPack={slug:string;code:string;name:string;icon:string;group_id:string;sort_order:number;featured:boolean;status:'live'|'soon';card_type:'alert'|'business';
 tagline:string;bullets:string[];schedule_label:string;price:'free'|'paid'|'business';scope_type:'city'|'route'|'national';cta_label:string|null;joinText:string|null};
export type SatifyMeta={groups:{id:string;name:string}[];whatsappNumber:string|null;cities:Record<string,string>;routes:Record<string,string>};

const BADGE_TEXT={measured:'Measured',official:'Official',forecast:'Forecast',estimate:'Estimate'} as const;
const LABELS:Record<string,string>={aqi:'Air quality (AQI)',aqi_label:'Air quality level',pm25:'PM2.5',aqi_forecast_max:'Peak AQI next 24h',temp_now:'Temperature now',temp_max:'Today’s high',temp_min:'Today’s low',feels_max:'Feels-like high',uv_max:'UV index',rain_chance:'Rain chance',
 visibility_km:'Visibility',fog_risk:'Fog risk',fog_clear_time:'Fog clears',fog_pct:'Fog cover',school_notice:'Official school notice',school_closure_chance:'Closure chance',usd_pkr:'Dollar (SBP)',usd_pkr_open:'Dollar (open market)',
 gold_usd_oz:'Gold spot',gold_tola:'Gold per tola',petrol_price:'Petrol per litre',diesel_price:'Diesel per litre',top_trend:'Top trend'};
const STRIP=['aqi','temp_now','visibility_km','rain_chance','usd_pkr','gold_tola','petrol_price'];
const SECTIONS:{title:string;ids:string[];note?:string}[]=[
 {title:'Air & weather',ids:['aqi_label','pm25','aqi_forecast_max','temp_max','temp_min','feels_max','uv_max','rain_chance']},
 {title:'Fog & roads',ids:['visibility_km','fog_risk','fog_clear_time','fog_pct']},
 {title:'Schools',ids:['school_notice','school_closure_chance'],note:'Closure chance is Satify’s prediction from smog, heat and fog. Only an official notice decides.'},
 {title:'Prices',ids:['usd_pkr','usd_pkr_open','gold_usd_oz','gold_tola','petrol_price','diesel_price']},
 {title:'Trending',ids:['top_trend']}
];
const time=(iso:string)=>{const d=new Date(iso);return Number.isNaN(d.valueOf())?'':new Intl.DateTimeFormat('en-PK',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Karachi'}).format(d)+' PKT';};
const show=(v:SatifyValue)=>v.value!==null?`${Math.abs(v.value)>=1000?Math.round(v.value).toLocaleString('en-US'):Math.round(v.value*10)/10}`:v.text??'';
const unitOf=(v:SatifyValue)=>v.value!==null&&v.unit?(v.unit==='Rs'?'':` ${v.unit}`):'';
const prefix=(v:SatifyValue)=>v.value!==null&&v.unit==='Rs'?'Rs ':'';

function Badge({b}:{b:SatifyValue['badge']}){return <span className={`satify-badge satify-badge-${b}`}>{BADGE_TEXT[b]}</span>;}
function Value({v,label,big}:{v:SatifyValue|undefined;label:string;big?:boolean}){
 if(!v)return <div className={`satify-tile satify-tile-empty${big?' satify-tile-big':''}`}><span className="satify-tile-label">{label}</span><span className="satify-tile-value">—</span><span className="satify-tile-meta">No data yet</span></div>;
 return <div className={`satify-tile${big?' satify-tile-big':''}`}><span className="satify-tile-label">{v.label}</span>
  <span className="satify-tile-value">{prefix(v)}{show(v)}{unitOf(v)}</span>
  <span className="satify-tile-meta"><Badge b={v.badge}/> {v.sourceUrl?<a href={v.sourceUrl} target="_blank" rel="noreferrer">{v.source}</a>:v.source} · {time(v.observedAt)}</span></div>;
}
function Qr({text}:{text:string}){
 const q=useMemo(()=>qrSvgPath(text),[text]);
 return <svg className="satify-qr" viewBox={`0 0 ${q.size} ${q.size}`} role="img" aria-label="QR code to join on WhatsApp" shapeRendering="crispEdges"><rect width={q.size} height={q.size} fill="#fff"/><path d={q.path} fill="#111"/></svg>;
}

function JoinCard({pack,meta,city}:{pack:SatifyPack;meta:SatifyMeta|null;city:string}){
 const places=pack.scope_type==='route'?Object.entries(meta?.routes??{}):pack.scope_type==='city'?Object.entries(meta?.cities??{}):[];
 const [place,setPlace]=useState(places.some(([k])=>k===city)?city:places[0]?.[0]??'');
 const text=`JOIN ${pack.code}${place?` ${place.toUpperCase()}`:''}`;
 const link=meta?.whatsappNumber?`https://wa.me/${meta.whatsappNumber}?text=${encodeURIComponent(text)}`:null;
 return <article className={`satify-pack${pack.featured?' satify-pack-featured':''}`}>
  <header><span className="satify-pack-icon" aria-hidden>{pack.icon}</span><div><h3>{pack.name}</h3><p>{pack.tagline}</p></div></header>
  <ul>{pack.bullets.map(b=><li key={b}>{b}</li>)}</ul>
  <p className="satify-pack-meta">{pack.schedule_label} · {pack.price==='free'?'Free':pack.price==='paid'?'Paid':'For schools'}</p>
  {places.length>0&&<label className="satify-field"><span>{pack.scope_type==='route'?'Route':'City'}</span><select value={place} onChange={e=>setPlace(e.target.value)}>{places.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>}
  {link?<div className="satify-join"><Qr text={link}/><div><p>Scan, or tap and send:</p><code>{text}</code><a className="satify-btn" href={link} target="_blank" rel="noreferrer">Open WhatsApp</a></div></div>
   :<div className="satify-join"><div><p>Send this on WhatsApp to the Satify number (announced soon):</p><code>{text}</code></div></div>}
 </article>;
}
function SoonCard({pack}:{pack:SatifyPack}){
 const [contact,setContact]=useState(''),[state,setState]=useState<'idle'|'busy'|'done'|'error'>('idle');
 async function notify(e:React.FormEvent){e.preventDefault();setState('busy');
  const r=await fetch('/api/satify?what=interest',{method:'POST',body:JSON.stringify({pack:pack.slug,contact})}).catch(()=>null);setState(r?.ok?'done':'error');}
 return <article className="satify-pack satify-pack-soon">
  <header><span className="satify-pack-icon" aria-hidden>{pack.icon}</span><div><h3>{pack.name} <span className="satify-soon">Coming soon</span></h3><p>{pack.tagline}</p></div></header>
  <ul>{pack.bullets.map(b=><li key={b}>{b}</li>)}</ul>
  {state==='done'?<p className="satify-ok">Thanks, we will tell you when it starts.</p>:
   <form className="satify-inline" onSubmit={notify}><input required minLength={5} maxLength={120} value={contact} placeholder="WhatsApp number or email" onChange={e=>setContact(e.target.value)} aria-label={`Notify me about ${pack.name}`}/><button className="satify-btn satify-btn-light" disabled={state==='busy'}>Notify me</button></form>}
  {state==='error'&&<p className="satify-err">Could not save. Check the number or email.</p>}
 </article>;
}
function SchoolsCard({pack,meta}:{pack:SatifyPack;meta:SatifyMeta|null}){
 const [f,setF]=useState({schoolName:'',city:'Lahore',contactName:'',phone:'',email:'',parentsEstimate:''}),[state,setState]=useState<'idle'|'busy'|'done'|'error'>('idle');
 const set=(k:keyof typeof f)=>(e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement>)=>setF({...f,[k]:e.target.value});
 async function send(e:React.FormEvent){e.preventDefault();setState('busy');
  const r=await fetch('/api/satify?what=schools',{method:'POST',body:JSON.stringify({...f,parentsEstimate:f.parentsEstimate||undefined})}).catch(()=>null);setState(r?.ok?'done':'error');}
 return <article className="satify-pack satify-pack-schools">
  <header><span className="satify-pack-icon" aria-hidden>{pack.icon}</span><div><h3>{pack.name}</h3><p>{pack.tagline}</p></div></header>
  <ul>{pack.bullets.map(b=><li key={b}>{b}</li>)}</ul>
  {state==='done'?<p className="satify-ok">Thank you. Satify will contact you to set up your school’s line.</p>:
  <form className="satify-form" onSubmit={send}>
   <input required minLength={2} maxLength={120} placeholder="School name" value={f.schoolName} onChange={set('schoolName')}/>
   <select value={f.city} onChange={set('city')}>{Object.values(meta?.cities??{Lahore:'Lahore'}).map(c=><option key={c}>{c}</option>)}<option>Other</option></select>
   <input required minLength={2} maxLength={80} placeholder="Your name" value={f.contactName} onChange={set('contactName')}/>
   <input required minLength={7} maxLength={20} placeholder="Phone / WhatsApp" value={f.phone} onChange={set('phone')}/>
   <input type="email" maxLength={120} placeholder="Email (optional)" value={f.email} onChange={set('email')}/>
   <input type="number" min={0} max={100000} placeholder="Number of parents (approx.)" value={f.parentsEstimate} onChange={set('parentsEstimate')}/>
   <button className="satify-btn" disabled={state==='busy'}>{pack.cta_label||'Register your school'}</button>
   {state==='error'&&<p className="satify-err">Could not send. Please check the details.</p>}
  </form>}
 </article>;
}

const DOMAINS=[
 {id:'air',title:'City & atmosphere',description:'Air quality, temperature and the conditions shaping your day.',icon:Wind,ids:SECTIONS[0].ids,related:['my-pulse','parents','health','events']},
 {id:'travel',title:'Mobility & travel',description:'Visibility, fog and travel planning.',icon:Car,ids:SECTIONS[1].ids,related:['motorway','school-van','north','flight','transport']},
 {id:'schools',title:'Community & education',description:'Official notices and forecast-based school planning.',icon:School,ids:[...SECTIONS[2].ids,'section144'],related:['parents','students','school-van','schools']},
 {id:'money',title:'Markets & economy',description:'Currency, gold and everyday fuel prices.',icon:Coins,ids:SECTIONS[3].ids,related:['my-pulse','overseas','rates','transport']},
 {id:'space',title:'Earth & satellite',description:'Rainfall, river flow, solar energy, hazards and city health.',icon:Satellite,ids:[],related:['farmers','solar','overseas','health']},
 {id:'pulse',title:'Daily pulse',description:'A concise view of the day’s signals.',icon:Radio,ids:['top_trend','temp_now','aqi','rain_chance'],related:['my-pulse','overseas']}
];
export function SatifyPage({packs,meta,initialCity,initialValues,badges,satellite}:{packs:SatifyPack[];meta:SatifyMeta|null;initialCity:string;initialValues:SatifyValue[];badges:Record<string,string>|null;satellite?:React.ReactNode}){
 const [city,setCity]=useState(initialCity),[values,setValues]=useState(initialValues),[loading,setLoading]=useState(false),[error,setError]=useState(false);
 const [domain,setDomain]=useState('air'),[group,setGroup]=useState('all'),[selected,setSelected]=useState<SatifyPack|null>(null),[relatedOnly,setRelatedOnly]=useState(false);
 const request=useRef<AbortController|null>(null),dialog=useRef<HTMLDialogElement>(null),rail=useRef<HTMLDivElement>(null),trigger=useRef<HTMLElement|null>(null);
 const byId=useMemo(()=>Object.fromEntries(values.map(v=>[v.id,v])),[values]);
 const current=DOMAINS.find(d=>d.id===domain)??DOMAINS[0];
 const cities=Object.entries(meta?.cities??{lahore:'Lahore'}),cityLabel=cities.find(([k])=>k===city)?.[1]??city;
 const groups=(meta?.groups??[]).filter(g=>packs.some(p=>p.group_id===g.id));
 const related=packs.filter(p=>current.related.includes(p.slug)||(domain==='schools'&&p.card_type==='business')||(domain==='money'&&p.group_id==='money'));
 const visible=(relatedOnly?related:packs).filter(p=>group==='all'||p.group_id===group);
 useEffect(()=>()=>request.current?.abort(),[]);
 useEffect(()=>{const el=dialog.current;if(selected&&el&&!el.open)el.showModal();},[selected]);
 useEffect(()=>{rail.current?.scrollTo({left:0});},[group,relatedOnly,domain]);
 async function pick(c:string){request.current?.abort();const controller=new AbortController();request.current=controller;setCity(c);setValues([]);setError(false);setLoading(true);
  try{const r=await fetch(`/api/satify?what=now&city=${encodeURIComponent(c)}`,{signal:controller.signal});const j=await r.json();if(!r.ok||!Array.isArray(j?.data))throw Error('Unavailable');if(!controller.signal.aborted)setValues(j.data);}catch{if(!controller.signal.aborted)setError(true);}finally{if(!controller.signal.aborted)setLoading(false);}}
 function openPack(p:SatifyPack){trigger.current=document.activeElement as HTMLElement;setSelected(p);}
 function closePack(){dialog.current?.close();}
 function alerts(){setRelatedOnly(true);setGroup('all');document.getElementById('satify-packs')?.scrollIntoView({behavior:'smooth',block:'start'});}
 function brief(id:string,fallback:string){const v=byId[id];return v?`${prefix(v)}${show(v)}${unitOf(v)}`:fallback;}
 return <div className="satify satify-v2">
  <section aria-labelledby="satify-title" className="satify-intelligence">
   <header className="satify-hero"><div className="satify-hero-copy"><p className="satify-eyebrow">FIFI / SATIFY INTELLIGENCE</p><h1 id="satify-title">Understand your world.</h1><p className="satify-lead">From your neighbourhood to outer space. Scientific observations, forecasts and official notices — connected to the decisions you make every day.</p><span className="satify-hero-tag"><Radio size={15}/> Public intelligence · Pakistan</span></div><div className="satify-orbit" aria-hidden="true"><Globe2 size={160} strokeWidth={.55}/><span/><span/><Satellite size={32}/></div>
   <div className="satify-citybar"><label>Explore your city <select value={city} onChange={e=>void pick(e.target.value)}>{cities.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><span role="status">{loading?'Updating…':error?'Data unavailable':`${values.length} available signals`}</span></div></header>
   {error&&<p role="alert" className="satify-err">Could not load {cityLabel}. <button onClick={()=>void pick(city)}>Retry</button></p>}
   <div className={`satify-strip${loading?' satify-loading':''}`} aria-label={`${cityLabel} snapshot`} aria-busy={loading}>{STRIP.map(id=><Value key={id} v={byId[id]} label={LABELS[id]??id} big/>)}</div>
   <div className="satify-brief"><div><p className="satify-kicker">YOUR DAILY BRIEF</p><h2>What matters in {cityLabel}</h2><p>Explore the signals behind your daily decisions.</p></div><div className="satify-brief-items">{[{id:'air',Icon:Wind,title:'Air quality',value:brief('aqi_label',brief('aqi','Not available'))},{id:'travel',Icon:Car,title:'Airport visibility',value:brief('visibility_km','Not available')},{id:'money',Icon:Coins,title:'Dollar (SBP)',value:brief('usd_pkr','Not available')}].map(b=><button key={b.id} onClick={()=>{setDomain(b.id);document.getElementById('satify-workspace')?.scrollIntoView({behavior:'smooth',block:'start'});}}><b.Icon size={23}/><span><small>{b.title}</small><strong>{b.value}</strong></span><ArrowUpRight size={17}/></button>)}</div></div>
   <div className="satify-heading"><div><p className="satify-kicker">01 / EXPLORE</p><h2>Intelligence in focus</h2><p>Choose a domain to reveal its data and connected alerts.</p></div></div>
   <div className="satify-domain-rail" aria-label="Intelligence domains">{DOMAINS.map(d=><button type="button" key={d.id} className={`satify-domain satify-domain-${d.id}`} aria-pressed={domain===d.id} onClick={()=>setDomain(d.id)}><d.icon size={32} strokeWidth={1.3}/><span><strong>{d.title}</strong><small>{d.description}</small></span><ArrowUpRight size={17}/></button>)}</div>
   <div className="satify-workspace" id="satify-workspace"><div className="satify-heading"><div><p className="satify-kicker">SELECTED INTELLIGENCE</p><h2>{current.title}</h2><p>{current.description}</p></div>{related.length>0&&<button className="satify-btn" onClick={alerts}><Bell size={16}/> Get related alerts</button>}</div>
   {domain==='space'?<div className="pci-sat-shell">{satellite??<p>Satellite intelligence unavailable.</p>}</div>:<div className="satify-grid">{current.ids.map(id=><Value key={id} v={byId[id]} label={LABELS[id]??(id==='section144'?'Section 144 / restrictions':id)}/>)}</div>}
   {domain==='schools'&&<p className="satify-muted">Closure chance is a Satify estimate. Only an official notice decides.</p>}{domain==='travel'&&<p className="satify-muted">Airport visibility is not a road closure report. Check the Motorway pack for current availability.</p>}
   {related.length>0&&<div className="satify-related"><span><Bell size={16}/> Take this intelligence with you</span>{related.map(p=><button key={p.slug} onClick={()=>openPack(p)}>{p.name} <ArrowUpRight size={13}/></button>)}</div>}</div>
   <details className="satify-provenance"><summary>Data sources & how to read our intelligence</summary><div className="satify-legend">{(Object.keys(BADGE_TEXT) as SatifyValue['badge'][]).map(b=><span key={b}><Badge b={b}/> {badges?.[b]??''}</span>)}</div><p>Every available reading includes its source and observation time. Forecasts and estimates are not official warnings. Missing readings are never replaced with invented data.</p></details>
  </section>
  <section className="satify-connect" aria-labelledby="satify-packs"><div className="satify-connect-banner"><div><p className="satify-eyebrow">02 / SATIFY CONNECT</p><h2 id="satify-packs">Stay informed. Stay ahead.</h2><p>The same intelligence, delivered to your phone. Choose your interests and activate a WhatsApp pack or register for upcoming services.</p></div><Bell size={65} strokeWidth={.8}/></div>
   <div className="satify-filter"><button className="satify-pill" aria-pressed={!relatedOnly&&group==='all'} onClick={()=>{setRelatedOnly(false);setGroup('all');}}>All intelligence</button><button className="satify-pill" aria-pressed={relatedOnly} onClick={()=>{setRelatedOnly(true);setGroup('all');}}>Related to {current.title}</button>{!relatedOnly&&groups.map(g=><button key={g.id} className="satify-pill" aria-pressed={group===g.id} onClick={()=>setGroup(group===g.id?'all':g.id)}>{g.name}</button>)}</div>
   <div className="satify-rail-header"><span>{visible.length} packs · Explore at your own pace</span><div><button aria-label="Previous packs" onClick={()=>rail.current?.scrollBy({left:-320,behavior:'smooth'})}><ChevronLeft/></button><button aria-label="Next packs" onClick={()=>rail.current?.scrollBy({left:320,behavior:'smooth'})}><ChevronRight/></button></div></div>
   <div className="satify-pack-rail" ref={rail}>{visible.map(p=><article key={p.slug} className={`satify-discovery-card satify-discovery-${p.group_id}`}><div className="satify-discovery-art"><span aria-hidden>{p.icon}</span><small>{p.card_type==='business'?'For organisations':p.status==='live'?'Available':'Coming soon'}</small></div><div className="satify-discovery-body"><h3>{p.name}</h3><p>{p.tagline}</p><ul>{p.bullets.slice(0,3).map(b=><li key={b}>{b}</li>)}</ul><button className="satify-btn" onClick={()=>openPack(p)}>{p.card_type==='business'?'Explore for schools':p.status==='live'?'Explore & join':'Notify me'} <ArrowUpRight size={15}/></button></div></article>)}</div>
   {!visible.length&&<p className="satify-muted">No packs available for this selection yet.</p>}
   <div className="satify-flow">{[{Icon:Satellite,label:'Observe'},{Icon:Radio,label:'Collect'},{Icon:Leaf,label:'Analyse'},{Icon:Bell,label:'Deliver'}].map(({Icon,label})=><span key={label}><Icon size={20}/>{label}</span>)}</div><p className="satify-muted">Opt in on WhatsApp. Send STOP any time to leave.</p>
  </section>
  <dialog ref={dialog} className="satify-modal" aria-label={selected?`${selected.name} subscription`:'Satify subscription'} onClose={()=>{setSelected(null);trigger.current?.focus();}} onClick={e=>{if(e.target===e.currentTarget)closePack();}}>{selected&&<div className="satify-modal-inner"><div className="satify-modal-top"><p className="satify-kicker">SATIFY CONNECT</p><button type="button" aria-label="Close dialog" onClick={closePack}><X size={22}/></button></div>{selected.card_type==='business'?<SchoolsCard key={selected.slug} pack={selected} meta={meta}/>:selected.status==='live'?<JoinCard key={selected.slug} pack={selected} meta={meta} city={city}/>:<SoonCard key={selected.slug} pack={selected}/>}</div>}</dialog>
 </div>;
}
