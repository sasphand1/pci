'use client';
import {useMemo,useState,useRef,useEffect} from 'react';
import {Wind,Car,School,Coins,ArrowUpRight,Bell,Radio,ChevronLeft,ChevronRight,Globe2,X,Sun,Users,GraduationCap,CloudFog,Thermometer,HeartPulse,Moon,Calendar,Plane,Mountain,Truck,Sprout,Waves,HardHat,Bike,Trophy,Bus} from 'lucide-react';
import {qrSvgPath} from '@/lib/qr';

export type SatifyValue={id:string;label:string;unit:string;value:number|null;text:string|null;badge:'measured'|'official'|'forecast'|'estimate';source:string;observedAt:string;sourceUrl:string|null};
export type SatifyPack={slug:string;code:string;name:string;icon:string;group_id:string;sort_order:number;featured:boolean;status:'live'|'soon';card_type:'alert'|'business';
 tagline:string;bullets:string[];schedule_label:string;price:'free'|'paid'|'business';scope_type:'city'|'route'|'national';cta_label:string|null;joinText:string|null};
export type SatifyMeta={groups:{id:string;name:string}[];whatsappNumber:string|null;cities:Record<string,string>;routes:Record<string,string>};

const BADGE_TEXT={measured:'Measured',official:'Official',forecast:'Forecast',estimate:'Estimate'} as const;
const LABELS:Record<string,string>={aqi:'Air quality (AQI)',aqi_label:'Air quality level',pm25:'PM2.5',aqi_forecast_max:'Peak AQI next 24h',aqi_forecast_label:'Smog level next 24h',temp_now:'Temperature now',temp_max:'Today’s high',temp_min:'Today’s low',feels_max:'Feels-like high',uv_max:'UV index',rain_chance:'Rain chance',
 visibility_km:'Visibility',fog_risk:'Fog risk',fog_clear_time:'Fog clears',fog_pct:'Fog cover',school_notice:'Official school notice',school_closure_chance:'Closure chance',usd_pkr:'Dollar (SBP)',usd_pkr_open:'Dollar (open market)',
 gold_usd_oz:'Gold spot',gold_tola:'Gold per tola',petrol_price:'Petrol per litre',diesel_price:'Diesel per litre',top_trend:'Top trend'};
const time=(iso:string)=>{const d=new Date(iso);return Number.isNaN(d.valueOf())?'':new Intl.DateTimeFormat('en-PK',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Karachi'}).format(d)+' PKT';};
const show=(v:SatifyValue|undefined)=>!v?'—':v.value!==null?(v.unit==='Rs'?'Rs ':'')+v.value.toLocaleString('en-US',{maximumFractionDigits:20})+(v.unit&&v.unit!=='Rs'?' '+v.unit:''):v.text??'—';
function Badge({b}:{b:SatifyValue['badge']}){return <span className={`satify-badge satify-badge-${b}`}>{BADGE_TEXT[b]}</span>;}
const packIcons:Record<string,typeof Wind>={'my-pulse':Sun,parents:Users,motorway:Car,students:GraduationCap,'school-van':Bus,overseas:Globe2,farmers:Sprout,health:HeartPulse,ramadan:Moon,events:Calendar,north:Mountain,flight:Plane,transport:Truck,solar:Sun,sea:Waves,build:HardHat,livestock:HeartPulse,delivery:Bike,rates:Coins,cricket:Trophy,schools:School};
function PackIcon({pack}:{pack:SatifyPack}){const Icon=packIcons[pack.slug]??(pack.card_type==='business'?School:Bell);return <Icon size={16} strokeWidth={1.7}/>;}
function Provenance({v}:{v?:SatifyValue}){return <small className="ps-source">{v?<><Badge b={v.badge}/> {v.sourceUrl?<a href={v.sourceUrl} target="_blank" rel="noreferrer">{v.source}</a>:v.source} · {time(v.observedAt)}</>:'No data yet'}</small>;}
function Metric({id,v}:{id:string;v?:SatifyValue}){return <div className="ps-metric"><span>{v?.label??LABELS[id]??({section144:'Section 144 / restrictions',route_visibility_km:'Route-end airport visibility',route_fog_clear_time:'Route fog clearing',motorway_status:'Route status',nhmp_status:'NHMP notice'} as Record<string,string>)[id]??id}</span><strong>{show(v)}</strong><Provenance v={v}/></div>;}
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
  <header><span className="satify-pack-icon" aria-hidden><PackIcon pack={pack}/></span><div><h3>{pack.name}</h3><p>{pack.tagline}</p></div></header>
  <ul>{pack.bullets.map(b=><li key={b}>{b}</li>)}</ul>
  <p className="satify-pack-meta">{pack.schedule_label} · {pack.price==='free'?'Free':pack.price==='paid'?'Paid':'For schools'}</p>
  {places.length>0&&<label className="satify-field"><span>{pack.scope_type==='route'?'Route':'City'}</span><select value={place} onChange={e=>setPlace(e.target.value)}>{places.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>}
  {link?<div className="satify-join"><Qr text={link}/><div><p>Scan with your phone camera, or open WhatsApp and send:</p><code>{text}</code><a className="satify-btn" href={link} target="_blank" rel="noreferrer">Continue on WhatsApp</a></div></div>
   :<div className="satify-join"><div><p>Send this on WhatsApp to the Pulsr number (announced soon):</p><code>{text}</code></div></div>}
 </article>;
}
function SoonCard({pack}:{pack:SatifyPack}){
 const [contact,setContact]=useState(''),[state,setState]=useState<'idle'|'busy'|'done'|'error'>('idle');
 async function notify(e:React.FormEvent){e.preventDefault();setState('busy');
  const r=await fetch('/api/satify?what=interest',{method:'POST',body:JSON.stringify({pack:pack.slug,contact})}).catch(()=>null);setState(r?.ok?'done':'error');}
 return <article className="satify-pack satify-pack-soon">
  <header><span className="satify-pack-icon" aria-hidden><PackIcon pack={pack}/></span><div><h3>{pack.name} <span className="satify-soon">Coming soon</span></h3><p>{pack.tagline}</p></div></header>
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
  <header><span className="satify-pack-icon" aria-hidden><PackIcon pack={pack}/></span><div><h3>{pack.name}</h3><p>{pack.tagline}</p></div></header>
  <ul>{pack.bullets.map(b=><li key={b}>{b}</li>)}</ul>
  {state==='done'?<p className="satify-ok">Thank you. Pulsr will contact you to set up your school’s line.</p>:
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

const SLIDES=[
 {title:'Air quality & atmosphere',main:'pm25',ids:['aqi_label','aqi_forecast_max','aqi_forecast_label'],pack:'my-pulse',cta:'Get AQI alerts',Icon:Wind},
 {title:'Visibility & mobility',main:'visibility_km',ids:['fog_risk','fog_clear_time','route_visibility_km','route_fog_clear_time','motorway_status','nhmp_status'],pack:'motorway',cta:'Motorway alerts',Icon:Car},
 {title:'Community & education',main:'school_notice',ids:['school_closure_chance','section144'],pack:'parents',cta:'Explore Parents',Icon:School},
 {title:'Markets & economy',main:'usd_pkr',ids:['usd_pkr_open','gold_usd_oz','gold_tola','petrol_price','diesel_price'],pack:'rates',cta:'Market alerts',Icon:Coins},
 {title:'Trending & notices',main:'top_trend',ids:['school_notice','section144'],pack:'my-pulse',cta:'Get My Pulse',Icon:Radio}
];
const TABS=['Daily Pulse','City & Atmosphere','Mobility & Travel','Community & Education','Markets & Economy','Trending & Notices'];
export function SatifyPage({packs,meta,initialCity,initialValues,badges}:{packs:SatifyPack[];meta:SatifyMeta|null;initialCity:string;initialValues:SatifyValue[];badges:Record<string,string>|null}){
 const [city,setCity]=useState(initialCity),[values,setValues]=useState(initialValues),[loading,setLoading]=useState(false),[error,setError]=useState(false);
 const [slide,setSlide]=useState(0),[tab,setTab]=useState(0),[group,setGroup]=useState('all'),[previewSlug,setPreviewSlug]=useState(packs[0]?.slug??''),[selected,setSelected]=useState<SatifyPack|null>(null);
 const [route,setRoute]=useState(Object.keys(meta?.routes??{})[0]??''),[routeValues,setRouteValues]=useState<SatifyValue[]>([]),[routeError,setRouteError]=useState(false),[routeLoading,setRouteLoading]=useState(false);
 const request=useRef<AbortController|null>(null),dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLElement|null>(null);
 const byId=useMemo(()=>Object.fromEntries(values.map(v=>[v.id,v])),[values]);
 const routeById=useMemo(()=>Object.fromEntries(routeValues.map(v=>[v.id,v])),[routeValues]);
 const cities=Object.entries(meta?.cities??{lahore:'Lahore'}),groups=(meta?.groups??[]).filter(g=>packs.some(p=>p.group_id===g.id));
 const visible=packs.filter(p=>group==='all'||p.group_id===group),preview=visible.find(p=>p.slug===previewSlug)??visible[0],current=SLIDES[slide];
 const status=(p:SatifyPack)=>p.card_type==='business'?'Registration':p.status==='live'?'Available':'Coming soon';
 useEffect(()=>()=>request.current?.abort(),[]);
 useEffect(()=>{const el=dialog.current;if(selected&&el&&!el.open)el.showModal();},[selected]);
 useEffect(()=>{if(slide!==1||!route)return;const controller=new AbortController();setRouteValues([]);setRouteError(false);setRouteLoading(true);fetch(`/api/satify?what=now&city=${encodeURIComponent(route)}`,{signal:controller.signal}).then(async r=>{const j=await r.json();if(!r.ok||!Array.isArray(j.data))throw Error('Unavailable');if(!controller.signal.aborted)setRouteValues(j.data);}).catch(()=>{if(!controller.signal.aborted)setRouteError(true);}).finally(()=>{if(!controller.signal.aborted)setRouteLoading(false);});return ()=>controller.abort();},[slide,route]);
 async function pick(c:string){request.current?.abort();const controller=new AbortController();request.current=controller;setCity(c);setValues([]);setError(false);setLoading(true);
  try{const r=await fetch(`/api/satify?what=now&city=${encodeURIComponent(c)}`,{signal:controller.signal});const j=await r.json();if(!r.ok||!Array.isArray(j?.data))throw Error('Unavailable');if(!controller.signal.aborted)setValues(j.data);}catch{if(!controller.signal.aborted)setError(true);}finally{if(!controller.signal.aborted)setLoading(false);}}
 function openPack(p:SatifyPack){trigger.current=document.activeElement as HTMLElement;setSelected(p);}
 function openSlug(slug:string){const p=packs.find(p=>p.slug===slug);if(p)openPack(p);}
 function closePack(){dialog.current?.close();}
 function goSlide(i:number){const n=(i+SLIDES.length)%SLIDES.length;setSlide(n);setTab(n+1);}
 function chooseTab(i:number){setTab(i);setSlide(i===0?0:i-1);}
 function action(slug:string,label:string){return <button type="button" className="ps-action" disabled={!packs.some(p=>p.slug===slug)} onClick={()=>openSlug(slug)}>{label} <ArrowUpRight size={13}/></button>;}
 function metric(id:string){return <Metric key={id} id={id} v={id.startsWith('route_')||id==='motorway_status'||id==='nhmp_status'?routeById[id]:byId[id]}/>;}
 function anchor(ids:string[],title:string,Icon:typeof Wind){return <div className="ps-panel ps-anchor"><div><span className="ps-label">{title}</span><div className="ps-anchor-values">{ids.map(id=><span key={id}>{show(byId[id])}</span>)}</div>{ids.map(id=><Provenance key={id} v={byId[id]}/>)}</div><Icon size={20}/></div>;}
 const previewPlaces=preview?.scope_type==='route'?Object.keys(meta?.routes??{}):preview?.scope_type==='city'?Object.keys(meta?.cities??{}):[];
 const preferredScope=preview?.scope_type==='route'?route:city;
 const previewPlace=previewPlaces.includes(preferredScope)?preferredScope:previewPlaces[0]??'';
 const previewPlaceLabel=preview?.scope_type==='route'?meta?.routes[previewPlace]:meta?.cities[previewPlace];
 const previewLink=preview?.status==='live'&&preview.card_type!=='business'&&meta?.whatsappNumber?`https://wa.me/${meta.whatsappNumber}?text=${encodeURIComponent(`JOIN ${preview.code}${previewPlace?' '+previewPlace.toUpperCase():''}`)}`:null;
 return <div className="pulsr-signals">
 <section className="ps-section" aria-labelledby="ps-title"><header className="ps-masthead"><div className="ps-mastrow"><div><p className="ps-kicker">PUBLIC INTELLIGENCE · PAKISTAN</p><h1 id="ps-title">Pulsr Signals</h1></div><div className="ps-controls"><label className="ps-city"><Globe2 size={15}/><select aria-label="Select city" value={city} onChange={e=>void pick(e.target.value)}>{cities.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>{action('my-pulse','Get daily brief')}</div></div>
 <div className="ps-navrow"><div className="ps-tabs" aria-label="Intelligence categories">{TABS.map((t,i)=><button type="button" key={t} aria-pressed={tab===i} onClick={()=>chooseTab(i)}>{t}</button>)}</div><div className="ps-legend">{(Object.keys(BADGE_TEXT) as SatifyValue['badge'][]).map(b=><span key={b} title={badges?.[b]}><Badge b={b}/></span>)}</div></div></header>
 <div role="status" className="ps-status">{loading?'Updating readings…':error?'Readings unavailable.':null}{error&&<button onClick={()=>void pick(city)}>Retry</button>}</div>
 <div className="ps-anchors" aria-busy={loading}>{anchor(['aqi','aqi_label'],'Current AQI',Wind)}{anchor(['temp_now'],'Temperature',Thermometer)}{anchor(['visibility_km'],'Airport visibility',CloudFog)}{anchor(['usd_pkr','gold_tola'],'USD / PKR · Gold 24k / tola',Coins)}</div>
 <div className="ps-dashboard"><article className="ps-panel ps-spotlight"><header className="ps-panel-head"><span className="ps-index">{String(slide+1).padStart(2,'0')} / 05</span><h2>{current.title}</h2><div className="ps-arrows"><button aria-label="Previous spotlight" onClick={()=>goSlide(slide-1)}><ChevronLeft size={16}/></button><button aria-label="Next spotlight" onClick={()=>goSlide(slide+1)}><ChevronRight size={16}/></button></div></header><div className="ps-spot-main"><div><strong>{show(byId[current.main])}</strong><span>{byId[current.main]?.label??LABELS[current.main]}</span><Provenance v={byId[current.main]}/></div><current.Icon size={42} strokeWidth={1.2}/></div>
 {slide===1&&<label className="ps-route">Route <select value={route} onChange={e=>{setRouteValues([]);setRoute(e.target.value);}}>{Object.entries(meta?.routes??{}).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>}{slide===1&&<small>{routeLoading?'Updating route…':routeError?'Route data unavailable.':'Airport observations are not measured motorway visibility or confirmed closures.'}</small>}
 <div className="ps-detail-grid">{current.ids.map(metric)}</div>{slide===2&&<small>Closure chance is a forecast estimate. Only an official notice decides.</small>}<footer className="ps-panel-footer"><div className="ps-dots">{SLIDES.map((s,i)=><button key={s.title} aria-label={s.title} aria-pressed={slide===i} onClick={()=>goSlide(i)}/>)}</div>{action(current.pack,current.cta)}</footer></article>
 <div className="ps-weather-stack"><article className="ps-panel"><header className="ps-panel-head"><Sun size={15}/><h2>Weather Intelligence</h2></header><div className="ps-detail-grid ps-weather-grid">{['temp_max','temp_min','feels_max','uv_max','rain_chance','fog_pct'].map(metric)}</div></article><article className="ps-panel"><header className="ps-panel-head"><Car size={15}/><h2>Visibility & Mobility</h2></header><div className="ps-detail-grid">{['visibility_km','fog_risk','fog_clear_time'].map(metric)}</div>{action('motorway','Motorway alerts')}</article></div>
 <article className="ps-panel ps-ledger"><header className="ps-panel-head"><Coins size={15}/><h2>Markets & Civic</h2></header>{['usd_pkr','usd_pkr_open','gold_tola','petrol_price','diesel_price','school_notice','section144','top_trend'].map(metric)}{action('rates','Notify on Markets')}</article></div></section>
 <section className="ps-section" aria-labelledby="ps-connect"><header className="ps-masthead"><h2 id="ps-connect">Pulsr Connect</h2><p className="ps-label">Personal intelligence, delivered when it matters.</p><div className="ps-tabs" aria-label="Notification categories"><button aria-pressed={group==='all'} onClick={()=>setGroup('all')}>All ({packs.length})</button>{groups.map(g=><button key={g.id} aria-pressed={group===g.id} onClick={()=>setGroup(g.id)}>{g.name}</button>)}</div></header>
 <div className="ps-connect-grid"><div className="ps-list" aria-label="Notification services">{visible.map(p=><button type="button" key={p.slug} aria-pressed={preview?.slug===p.slug} onMouseEnter={()=>setPreviewSlug(p.slug)} onFocus={()=>setPreviewSlug(p.slug)} onClick={()=>setPreviewSlug(p.slug)}><span className={`ps-dot ps-dot-${p.card_type==='business'?'registration':p.status}`}/><PackIcon pack={p}/><strong>{p.name}</strong><span className="ps-description">— {p.tagline}</span><span className="ps-pack-status">{status(p)}</span><ArrowUpRight size={13}/></button>)}{!visible.length&&<p className="ps-label">No services available.</p>}</div>
 <div className="ps-connect-side">{preview&&<aside className="ps-pass"><header><span className="ps-kicker">{groups.find(g=>g.id===preview.group_id)?.name??'Personal intelligence'}</span><span>{status(preview)}</span></header><div className="ps-pass-title"><PackIcon pack={preview}/><div><h3>{preview.name}</h3><p>{preview.tagline}</p></div></div><div className="ps-pass-qr">{previewLink?<Qr text={previewLink}/>:<Bell size={28}/>}<div><strong>{previewLink?'Scan to activate':preview.card_type==='business'?'School registration':preview.status==='live'?'Activation unavailable':'Early access'}</strong><p>{previewPlaceLabel?`${previewPlaceLabel} · `:''}{preview.schedule_label}</p></div></div><span className="ps-kicker">What you receive</span><ul>{preview.bullets.map(b=><li key={b}>{b}</li>)}</ul><button className="ps-gold" onClick={()=>openPack(preview)}>{preview.card_type==='business'?'Register school':preview.status==='live'?`Activate ${preview.name}`:'Notify me'} <ArrowUpRight size={14}/></button></aside>}
 <aside className="ps-panel ps-reach"><header className="ps-panel-head"><h2>Network Reach</h2></header><div><Users size={17}/><span>Total subscribers</span><strong>—</strong></div><div><Radio size={17}/><span>Total broadcasts sent</span><strong>—</strong></div><small>Public totals unavailable.</small></aside></div></div></section>
 <dialog ref={dialog} className="satify-modal ps-modal" aria-label={selected?`${selected.name} subscription`:'Pulsr Connect'} onClose={()=>{setSelected(null);trigger.current?.focus();}} onClick={e=>{if(e.target===e.currentTarget)closePack();}}>{selected&&<div className="satify-modal-inner"><div className="satify-modal-top"><p className="ps-kicker">PULSR CONNECT</p><button type="button" aria-label="Close dialog" onClick={closePack}><X size={20}/></button></div>{selected.card_type==='business'?<SchoolsCard key={selected.slug} pack={selected} meta={meta}/>:selected.status==='live'?<JoinCard key={selected.slug} pack={selected} meta={meta} city={selected.scope_type==='route'?route:city}/>:<SoonCard key={selected.slug} pack={selected}/>}<small>Opt-in only. Send STOP to unsubscribe from active alerts.</small></div>}</dialog>
 </div>;
}
