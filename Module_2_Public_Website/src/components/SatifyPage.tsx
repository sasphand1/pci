'use client';
import {useMemo,useState,useRef,useEffect} from 'react';
import {Wind,Car,School,Coins,ArrowUpRight,Bell,Radio,ChevronLeft,ChevronRight,Globe2,X,Sun,Users,GraduationCap,CloudFog,Thermometer,HeartPulse,Moon,Calendar,Plane,Mountain,Truck,Sprout,Waves,HardHat,Bike,Trophy,Bus,Gauge,MapPin,QrCode,Eye} from 'lucide-react';
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
function PackIcon({pack,size=16}:{pack:SatifyPack;size?:number}){const Icon=packIcons[pack.slug]??(pack.card_type==='business'?School:Bell);return <Icon size={size} strokeWidth={1.7}/>;}
// Use only the existing Fifi theme utilities and reusable shared Satify components.
const PANEL='min-w-0 rounded-lg border border-border bg-background p-4';
const SMALL='text-xs leading-4 text-muted-foreground';
const MINI='text-[11px] leading-4 text-muted-foreground';
const LABEL='font-medium text-xs leading-4';
const MONO='font-mono tabular-nums';
const PILL='inline-flex items-center justify-center gap-1 rounded-full border px-3 py-1 text-xs leading-4 font-medium whitespace-nowrap';
const ACTIVE='border-primary bg-primary text-primary-foreground';
const INACTIVE='border-border bg-background text-foreground hover:border-primary';
const BUTTON='inline-flex items-center justify-center gap-1 rounded-full bg-primary text-primary-foreground px-3 py-1 text-xs leading-4 font-semibold disabled:opacity-50';
const BOX='min-w-0 rounded-md border border-border bg-card px-3 py-2';
function sourceTitle(v?:SatifyValue){return v?`${BADGE_TEXT[v.badge]} · ${v.source} · ${time(v.observedAt)}`:'No data yet';}
function Reading({v,unit=true}:{v?:SatifyValue;unit?:boolean}){
 const value=unit?show(v):v?.value!=null?v.value.toLocaleString('en-US',{maximumFractionDigits:20}):v?.text??'—';
 return v?.sourceUrl?<a className="hover:underline" href={v.sourceUrl} target="_blank" rel="noreferrer" title={sourceTitle(v)} aria-label={`${value}; ${sourceTitle(v)}`}>{value}</a>:<span title={sourceTitle(v)} aria-label={`${value}; ${sourceTitle(v)}`}>{value}</span>;
}
function Provenance({v}:{v?:SatifyValue}){return <small className={MINI}>{v?<>{BADGE_TEXT[v.badge]} · {v.sourceUrl?<a className="hover:underline" href={v.sourceUrl} target="_blank" rel="noreferrer">{v.source}</a>:v.source} · {time(v.observedAt)}</>:'No data yet'}</small>;}
function Metric({id,v}:{id:string;v?:SatifyValue}){return <div className={BOX}><span className={`${MINI} block`}>{LABELS[id]??v?.label??({section144:'Section 144 / restrictions',route_visibility_km:'Route-end airport visibility',route_fog_clear_time:'Route fog clearing',motorway_status:'Route status',nhmp_status:'NHMP notice'} as Record<string,string>)[id]??id}</span><strong className={`${MONO} text-sm font-medium break-words`}><Reading v={v}/></strong></div>;}
function Qr({text,compact=false}:{text:string;compact?:boolean}){
 const q=useMemo(()=>qrSvgPath(text),[text]);
 return <svg className={compact?"satify-qr w-12 h-12 rounded-sm shrink-0":"satify-qr"} viewBox={`0 0 ${q.size} ${q.size}`} role="img" aria-label="QR code to join on WhatsApp" shapeRendering="crispEdges"><rect width={q.size} height={q.size} fill="#fff"/><path d={q.path} fill="#111"/></svg>;
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
function SchoolsCard({pack,meta,city}:{pack:SatifyPack;meta:SatifyMeta|null;city:string}){
 const [f,setF]=useState({schoolName:'',city:meta?.cities[city]??'Lahore',contactName:'',phone:'',email:'',parentsEstimate:''}),[state,setState]=useState<'idle'|'busy'|'done'|'error'>('idle');
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
 const visible=group==='all'?[...packs.filter(p=>p.status==='live'&&p.card_type==='alert'),...packs.filter(p=>p.card_type==='business'),...packs.filter(p=>p.status==='soon'&&p.card_type==='alert')]:packs.filter(p=>p.group_id===group),preview=visible.find(p=>p.slug===previewSlug)??visible[0],current=SLIDES[slide];
 const status=(p:SatifyPack)=>p.card_type==='business'?'Registration':p.status==='live'?'Available':'Coming soon';
 useEffect(()=>()=>request.current?.abort(),[]);
 useEffect(()=>{const el=dialog.current;if(selected&&el&&!el.open)el.showModal();},[selected]);
 useEffect(()=>{if(!route)return;const controller=new AbortController();setRouteValues([]);setRouteError(false);setRouteLoading(true);fetch(`/api/satify?what=now&city=${encodeURIComponent(route)}`,{signal:controller.signal}).then(async r=>{const j=await r.json();if(!r.ok||!Array.isArray(j.data))throw Error('Unavailable');if(!controller.signal.aborted)setRouteValues(j.data);}).catch(()=>{if(!controller.signal.aborted)setRouteError(true);}).finally(()=>{if(!controller.signal.aborted)setRouteLoading(false);});return ()=>controller.abort();},[route]);
 async function pick(c:string){request.current?.abort();const controller=new AbortController();request.current=controller;setCity(c);setValues([]);setError(false);setLoading(true);
  try{const r=await fetch(`/api/satify?what=now&city=${encodeURIComponent(c)}`,{signal:controller.signal});const j=await r.json();if(!r.ok||!Array.isArray(j?.data))throw Error('Unavailable');if(!controller.signal.aborted)setValues(j.data);}catch{if(!controller.signal.aborted)setError(true);}finally{if(!controller.signal.aborted)setLoading(false);}}
 function openPack(p:SatifyPack){trigger.current=document.activeElement as HTMLElement;setSelected(p);}
 function openSlug(slug:string){const p=packs.find(p=>p.slug===slug);if(p)openPack(p);}
 function closePack(){dialog.current?.close();}
 function goSlide(i:number){const n=(i+SLIDES.length)%SLIDES.length;setSlide(n);if(tab!==0)setTab(n+1);}
 function chooseTab(i:number){setTab(i);setSlide(i===0?0:i-1);}
 function action(slug:string,label:string,solid=false){return <button type="button" className={solid?BUTTON:'inline-flex items-center justify-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-50'} disabled={!packs.some(p=>p.slug===slug)} onClick={()=>openSlug(slug)}>{label} <ArrowUpRight size={13}/></button>;}
 function metric(id:string){return <Metric key={id} id={id} v={id.startsWith('route_')||id==='motorway_status'||id==='nhmp_status'?routeById[id]:byId[id]}/>;}
 function ledger(label:string,id:string){const v=byId[id];return <div className="flex items-center justify-between gap-2 border-b border-border py-1 last:border-0"><div className="min-w-0"><span className={`${MINI} block`}>{label}</span>{v&&<span className="block truncate text-[10px] leading-3 text-muted-foreground" title={sourceTitle(v)}>{BADGE_TEXT[v.badge]} · {v.source.includes("Frankfurter")?"Frankfurter":v.source}</span>}</div><strong className={`${MONO} text-xs font-semibold text-right whitespace-nowrap shrink-0`}><Reading v={v}/></strong></div>;}
 const previewPlaces=preview?.scope_type==='route'?Object.keys(meta?.routes??{}):preview?.scope_type==='city'?Object.keys(meta?.cities??{}):[];
 const preferredScope=preview?.scope_type==='route'?route:city;
 const previewPlace=previewPlaces.includes(preferredScope)?preferredScope:previewPlaces[0]??'';
 const previewPlaceLabel=preview?.scope_type==='route'?meta?.routes[previewPlace]:meta?.cities[previewPlace];
 const previewLink=preview?.status==='live'&&preview.card_type!=='business'&&meta?.whatsappNumber?`https://wa.me/${meta.whatsappNumber}?text=${encodeURIComponent(`JOIN ${preview.code}${previewPlace?' '+previewPlace.toUpperCase():''}`)}`:null;
 const live=packs.filter(p=>p.card_type==='alert'&&p.status==='live').length;
 const schoolCount=packs.filter(p=>p.card_type==='business').length;
 const upcoming=packs.filter(p=>p.card_type==='alert'&&p.status==='soon').length;
 const anchorClass=`${PANEL} flex items-center justify-between gap-2 py-4`;
 const primaryValue=`${MONO} text-2xl leading-7 font-semibold`;
 const sourceFor=(id:string)=>{const name=byId[id]?.source;if(!name)return 'No data yet';if(name.includes('METAR'))return 'METAR';if(name.includes('MET Norway'))return 'MET Norway';return name;};
 return <div className="grid min-w-0 gap-4" data-signals-layout="editorial">
  <section className="content-card grid gap-4 p-4 sm:p-6" aria-labelledby="ps-title">
   <header className="grid gap-3 border-b border-border pb-3">
    <div className="flex flex-wrap items-end justify-between gap-3">
     <div className="min-w-0"><p className={`${MONO} text-[11px] leading-4 text-primary tracking-wide uppercase`}>PULSR / PUBLIC INTELLIGENCE{byId.aqi?.observedAt?` · ${time(byId.aqi.observedAt)}`:''}</p><h1 id="ps-title" className="font-sans text-3xl sm:text-4xl leading-tight font-bold tracking-tight mt-1">Pulsr Signals</h1></div>
     <div className="flex items-center gap-2"><label className={`${PILL} bg-background border-border`}><MapPin size={14} className="text-primary"/><select className="bg-transparent text-xs font-medium cursor-pointer max-w-full" aria-label="Select city" value={city} onChange={e=>void pick(e.target.value)}>{cities.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>{action('my-pulse','Get daily brief',true)}</div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-1" aria-label="Intelligence categories">{TABS.map((t,i)=><button type="button" key={t} className={`${PILL} ${tab===i?ACTIVE:INACTIVE}`} aria-pressed={tab===i} onClick={()=>chooseTab(i)}>{t}</button>)}</div><div className="flex items-center gap-1" aria-label="Data classifications">{(Object.keys(BADGE_TEXT) as SatifyValue['badge'][]).map(b=><span key={b} className="text-[10px]" title={badges?.[b]}><Badge b={b}/></span>)}</div></div>
   </header>
   {(loading||error)&&<div role="status" className={SMALL}>{loading?'Updating readings…':'Readings unavailable.'}{error&&<button className="text-primary underline ml-2" onClick={()=>void pick(city)}>Retry</button>}</div>}
   {/* Constant four-card anchor strip. No additional banner or trajectory chart. */}
   <div className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-label="Core signals" aria-busy={loading}>
    <article className={anchorClass}><div className="min-w-0"><p className={MINI}>Current AQI{byId.aqi?` · ${BADGE_TEXT[byId.aqi.badge]}`:''}</p><div className="flex items-baseline gap-2 flex-wrap"><strong className={primaryValue}><Reading v={byId.aqi}/></strong><span className="text-xs text-muted-foreground"><Reading v={byId.aqi_label}/></span></div></div>{byId.aqi&&<span className="w-2 h-2 bg-gold rounded-full shrink-0" aria-hidden="true"/>}</article>
    <article className={anchorClass}><div className="min-w-0"><p className={MINI}>Temperature · {sourceFor('temp_now')}</p><div className="flex items-baseline gap-2 flex-wrap"><strong className={primaryValue}><Reading v={byId.temp_now}/></strong><span className={MINI}>H <Reading v={byId.temp_max}/></span></div></div><Thermometer size={20} className="text-primary shrink-0"/></article>
    <article className={anchorClass}><div className="min-w-0"><p className={MINI}>Airport visibility{byId.visibility_km?` · ${BADGE_TEXT[byId.visibility_km.badge]}`:''}</p><div className="flex items-baseline gap-2 flex-wrap"><strong className={primaryValue}><Reading v={byId.visibility_km}/></strong>{byId.visibility_km&&<span className={MINI}>{sourceFor('visibility_km')}</span>}</div></div><Eye size={20} className="text-primary shrink-0"/></article>
    <article className={anchorClass}><div className="min-w-0"><p className={MINI}>USD (SBP) · Gold 24k/tola</p><strong className={`${MONO} text-lg leading-6 font-semibold flex items-baseline gap-1 flex-wrap`}><Reading v={byId.usd_pkr} unit={false}/><span className="text-muted-foreground">·</span><Reading v={byId.gold_tola} unit={false}/></strong></div><span className={`${MONO} text-xs text-primary shrink-0`}>PKR</span></article>
   </div>
   {/* Stitch 5:4:3 composition. Uses the existing 12-column utility grid. */}
   <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch" data-layout="5-4-3">
    <article className={`${PANEL} lg:col-span-5 flex flex-col justify-between gap-3`} aria-label="Intelligence spotlight">
     <header className="flex items-center gap-2 justify-between"><div className="flex items-center gap-1 min-w-0"><span className={`${MONO} rounded-full px-2 py-0.5 bg-primary text-primary-foreground text-[10px] whitespace-nowrap`}>{String(slide+1).padStart(2,'0')} / 05</span><h2 className="text-xs font-semibold uppercase tracking-wide text-primary">{current.title}</h2></div><div className="flex gap-1 shrink-0"><button type="button" className="w-7 h-7 grid place-items-center rounded-full border border-border bg-card hover:border-primary" aria-label="Previous spotlight" onClick={()=>goSlide(slide-1)}><ChevronLeft size={15}/></button><button type="button" className="w-7 h-7 grid place-items-center rounded-full border border-border bg-card hover:border-primary" aria-label="Next spotlight" onClick={()=>goSlide(slide+1)}><ChevronRight size={15}/></button></div></header>
     <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2"><div className="min-w-0"><strong className={`${MONO} text-4xl leading-tight font-semibold break-words`}><Reading v={byId[current.main]} unit={slide!==0}/></strong>{slide===0&&<span className="text-xs ml-2 text-muted-foreground">{byId.pm25?.unit??"µg/m³"}</span>}<p className={SMALL}>{slide===0?<>PM2.5 · <Reading v={byId.aqi_label}/></>:LABELS[current.main]??byId[current.main]?.label}</p></div>{slide===0?<Gauge size={44} className="text-gold shrink-0" aria-hidden="true"/>:<current.Icon size={40} strokeWidth={1.4} className="text-primary shrink-0" aria-hidden="true"/>}</div>
      {slide===1&&<label className="flex flex-wrap gap-2 items-center text-xs">Route <select className="rounded-md border border-border bg-card px-2 py-1 text-xs max-w-full" value={route} onChange={e=>{setRouteValues([]);setRoute(e.target.value);}}>{Object.entries(meta?.routes??{}).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>}
      {slide===1&&<small className={MINI}>{routeLoading?'Updating route…':routeError?'Route data unavailable.':'Airport observations are not measured motorway visibility or confirmed closures.'}</small>}
      <div className="grid grid-cols-2 gap-2">{(slide===0?current.ids.filter(id=>id!=='aqi_label'):current.ids).map(metric)}</div>
      {slide===2&&<small className={MINI}>Closure chance is an estimate. Only an official notice decides.</small>}
      <Provenance v={byId[current.main]}/>
     </div>
     <footer className="flex items-center justify-between gap-2 border-t border-border pt-2 mt-auto"><div className="flex items-center gap-1">{SLIDES.map((item,i)=><button key={item.title} type="button" className={`h-1.5 rounded-full ${slide===i?'w-5 bg-primary':'w-2 bg-border'}`} aria-label={item.title} aria-pressed={slide===i} onClick={()=>goSlide(i)}/>)}</div>{action(current.pack,current.cta)}</footer>
    </article>
    <div className="lg:col-span-4 grid gap-3" aria-label="Weather and mobility">
     <article className={`${PANEL} flex flex-col justify-between gap-2`}><header className="flex flex-wrap items-center justify-between gap-1"><h2 className="flex items-center gap-1 text-xs font-medium"><Sun size={15} className="text-primary"/>Weather Intelligence</h2>{byId.temp_now&&<span className="text-[10px] leading-4 text-gold-foreground bg-gold-soft rounded px-1" title={sourceTitle(byId.temp_now)}>{sourceFor('temp_now')} · {BADGE_TEXT[byId.temp_now.badge]}</span>}</header>
      <div className="grid grid-cols-3 gap-1 text-center"><div className={BOX}><span className={`${MINI} block`}>High / Low</span><strong className={`${MONO} text-xs font-medium`}><Reading v={byId.temp_max} unit={false}/>{byId.temp_max?.value!=null?"°":""} / <Reading v={byId.temp_min} unit={false}/>{byId.temp_min?.value!=null?"°":""}</strong></div><div className={BOX}><span className={`${MINI} block`}>Feels-like</span><strong className={`${MONO} text-xs font-medium`}><Reading v={byId.feels_max}/></strong></div><div className={BOX}><span className={`${MINI} block`}>UV / Rain</span><strong className={`${MONO} text-xs font-medium`}><Reading v={byId.uv_max}/> / <Reading v={byId.rain_chance}/></strong></div></div>
      <div className="flex justify-between gap-2 border-t border-border pt-2"><span className={MINI}>Current fog coverage</span><span className={`${MONO} text-xs`}><Reading v={byId.fog_pct}/></span></div></article>
     <article className={`${PANEL} flex flex-col gap-1`}><header className="flex flex-wrap items-center justify-between gap-1"><h2 className={LABEL}>Visibility &amp; Mobility</h2>{byId.visibility_km&&<span className="text-[10px] bg-sage rounded px-1 text-sage-foreground" title={sourceTitle(byId.visibility_km)}>METAR · {BADGE_TEXT[byId.visibility_km.badge]}</span>}</header><div className="flex items-center justify-between gap-2"><span className={MINI}>Airport / route-end visibility</span><strong className={`${MONO} text-xs text-right`}><Reading v={byId.visibility_km}/> / <Reading v={routeById.route_visibility_km}/></strong></div><div className="flex flex-wrap items-center justify-between gap-1"><span className={MINI} title={meta?.routes[route]}>{meta?.routes[route]??'Motorway'} · advisory only</span>{action('motorway','Motorway alerts')}</div></article>
    </div>
    <article className={`${PANEL} lg:col-span-3 flex flex-col gap-1`} aria-label="Markets and civic"><header className="flex justify-between items-center border-b border-border pb-1 gap-1"><h2 className={`${MONO} text-xs uppercase font-medium text-primary`}>Markets &amp; Civic</h2><span className={MINI}>{byId.usd_pkr?.observedAt?time(byId.usd_pkr.observedAt).split(',')[0]:''}</span></header><div className="flex-1">{ledger('USD/PKR (SBP)','usd_pkr')}{ledger('Open-market USD','usd_pkr_open')}{ledger('Gold 24k / tola','gold_tola')}<div className="flex justify-between gap-1 py-1 border-b border-border"><span className={MINI}>Petrol / Diesel</span><strong className={`${MONO} text-xs text-right`}><Reading v={byId.petrol_price}/> / <Reading v={byId.diesel_price}/></strong></div><div className="flex justify-between gap-1 py-1 border-b border-border"><span className={MINI}>Schools &amp; Sec 144</span><strong className="text-xs text-right"><Reading v={byId.school_notice}/> · <Reading v={byId.section144}/></strong></div>{ledger('Top trend','top_trend')}</div>{action('rates','Notify on Markets',true)}</article>
   </div>
  </section>
  <section className="content-card grid gap-3 p-4 sm:p-6" aria-labelledby="ps-connect">
   <header className="grid gap-2 pb-3 border-b border-border"><div><p className={`${MONO} text-[11px] leading-4 text-primary uppercase tracking-wide`}>PULSR / CONNECT</p><h2 id="ps-connect" className="font-sans text-2xl leading-tight font-semibold tracking-tight mt-1">Pulsr Connect</h2><p className={SMALL}>{live} available {live===1?'pack':'packs'}, {schoolCount} school registration {schoolCount===1?'service':'services'}, and {upcoming} upcoming {upcoming===1?'pack':'packs'} — choose a service to preview or activate.</p></div><div className="flex gap-1 flex-wrap" aria-label="Notification categories"><button type="button" className={`${PILL} ${group==='all'?ACTIVE:INACTIVE}`} aria-pressed={group==='all'} onClick={()=>setGroup('all')}>All ({packs.length})</button>{groups.map(g=><button type="button" key={g.id} className={`${PILL} ${group===g.id?ACTIVE:INACTIVE}`} aria-pressed={group===g.id} onClick={()=>setGroup(g.id)}>{g.name}</button>)}</div></header>
   <div className="grid grid-cols-1 lg:grid-cols-12 items-start gap-4" data-layout="7-5">
    <div className="lg:col-span-7 min-w-0 rounded-md border border-border bg-background overflow-hidden divide-y divide-border" aria-label="Notification services">{visible.map(p=><button type="button" key={p.slug} className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left border-b border-border last:border-b-0 border-l-2 ${preview?.slug===p.slug?'bg-card border-l-primary':'bg-transparent border-l-transparent hover:bg-card'}`} aria-pressed={preview?.slug===p.slug} onMouseEnter={()=>setPreviewSlug(p.slug)} onFocus={()=>setPreviewSlug(p.slug)} onClick={()=>setPreviewSlug(p.slug)}><span className="flex min-w-0 items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.card_type==='business'?'bg-gold':p.status==='live'?'bg-primary':'bg-border'}`} aria-hidden="true"/><span className="text-primary shrink-0"><PackIcon pack={p}/></span><strong className="text-xs font-semibold shrink-0">{p.name}</strong><span className={`${SMALL} hidden sm:block truncate`}>— {p.tagline}</span></span><span className="flex items-center gap-2 shrink-0"><span className={`${MONO} text-[10px] leading-4 text-muted-foreground`}>{status(p)}</span><span className="text-primary">{p.status==='live'&&p.card_type!=='business'?<QrCode size={13}/>:<ArrowUpRight size={13}/>}</span></span></button>)}{!visible.length&&<p className="p-3 text-xs text-muted-foreground">No services available.</p>}</div>
    <div className="lg:col-span-5 min-w-0 grid gap-3" aria-label="Service preview">
     {preview&&<aside className="rounded-lg bg-foreground text-background p-4 grid gap-2"><header className="flex justify-between items-center gap-2"><span className={`${MONO} text-[11px] text-gold uppercase`}>{groups.find(g=>g.id===preview.group_id)?.name??'Personal intelligence'} · {preview.card_type==='business'?'Registration':preview.status==='live'?'Live':'Upcoming'}</span><span className="rounded-full bg-primary-light text-primary-foreground px-2 py-0.5 text-[10px]">{status(preview)}</span></header><div className="flex items-center gap-2"><span className="grid place-items-center rounded-md bg-primary-light text-gold w-9 h-9 shrink-0"><PackIcon pack={preview} size={20}/></span><div className="min-w-0"><h3 className="text-base font-semibold leading-5">{preview.name}</h3><p className="text-xs leading-4 opacity-80">{preview.tagline}</p></div></div><div className="rounded-md bg-card text-foreground p-2 flex items-center gap-2">{previewLink?<Qr text={previewLink} compact/>:<span className="text-primary shrink-0"><Bell size={32}/></span>}<div className="min-w-0"><p className="text-xs font-medium">{previewLink?'Scan to join':preview.card_type==='business'?'School registration':preview.status==='live'?'Activation unavailable':'Early-access waitlist'}</p><p className={MINI}>{previewPlaceLabel?`${previewPlaceLabel} · `:''}{preview.schedule_label}</p></div></div><div><p className={`${MONO} text-[10px] uppercase text-primary-foreground opacity-80`}>What you receive</p><ul className="text-xs leading-4 list-disc pl-4">{preview.bullets.map(b=><li key={b}>{b}</li>)}</ul></div><button type="button" className="w-full inline-flex items-center justify-center gap-1 rounded-md bg-gold text-foreground px-3 py-2 text-xs font-semibold" onClick={()=>openPack(preview)}>{preview.card_type==='business'?'Register school':preview.status==='live'?`Activate ${preview.name}`:'Notify me'} <ArrowUpRight size={13}/></button></aside>}
     <aside className={`${PANEL} grid gap-2`} aria-label="Network Reach"><header className="flex items-center justify-between gap-2 border-b border-border pb-2"><h3 className={`${MONO} text-xs uppercase text-primary`}>Network Reach</h3><span className={MINI}>Unavailable</span></header><div className="flex gap-2 items-center"><span className="w-8 h-8 rounded-md grid place-items-center bg-sage text-sage-foreground shrink-0"><Users size={16}/></span><div className="flex-1"><p className={LABEL}>Total subscribers</p><p className={MINI}>Opted-in intelligence briefings</p></div><strong className={`${MONO} text-lg font-semibold`}>—</strong></div><div className="flex gap-2 items-center border-t border-border pt-2"><span className="w-8 h-8 rounded-md grid place-items-center bg-gold-soft text-gold-foreground shrink-0"><Radio size={16}/></span><div className="flex-1"><p className={LABEL}>Total broadcasts sent</p><p className={MINI}>Daily dispatches</p></div><strong className={`${MONO} text-lg font-semibold`}>—</strong></div><small className={MINI}>Public totals unavailable.</small></aside>
    </div>
   </div>
  </section>
  {/* Existing reusable glass dialog, not a new CSS implementation. */}
  <div className="satify-v2 pulsr-signals contents"><dialog ref={dialog} className="satify-modal ps-modal" aria-label={selected?`${selected.name} subscription`:'Pulsr Connect'} onClose={()=>{setSelected(null);trigger.current?.focus();}} onClick={e=>{if(e.target===e.currentTarget)closePack();}}>{selected&&<div className="satify-modal-inner"><div className="satify-modal-top"><p className="satify-kicker ps-kicker">PULSR CONNECT</p><button type="button" aria-label="Close dialog" onClick={closePack}><X size={20}/></button></div>{selected.card_type==='business'?<SchoolsCard key={selected.slug} pack={selected} meta={meta} city={city}/>:selected.status==='live'?<JoinCard key={selected.slug} pack={selected} meta={meta} city={selected.scope_type==='route'?route:city}/>:<SoonCard key={selected.slug} pack={selected}/>}<small>Opt-in only. Send STOP to unsubscribe from active alerts.</small></div>}</dialog></div>
 </div>;
}
