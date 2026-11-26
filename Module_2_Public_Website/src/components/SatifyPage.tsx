'use client';
import {useMemo,useState} from 'react';
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
 if(!v)return <div className={`satify-tile satify-tile-empty${big?' satify-tile-big':''}`}><span className="satify-tile-label">{label}</span><span className="satify-tile-value">PH</span><span className="satify-tile-meta">No data yet</span></div>;
 return <div className={`satify-tile${big?' satify-tile-big':''}`}><span className="satify-tile-label">{v.label}</span>
  <span className="satify-tile-value">{prefix(v)}{show(v)}{unitOf(v)}</span>
  <span className="satify-tile-meta"><Badge b={v.badge}/> {v.sourceUrl?<a href={v.sourceUrl} target="_blank" rel="noreferrer">{v.source}</a>:v.source} · {time(v.observedAt)}</span></div>;
}
function Qr({text}:{text:string}){
 const q=useMemo(()=>qrSvgPath(text),[text]);
 return <svg className="satify-qr" viewBox={`0 0 ${q.size} ${q.size}`} role="img" aria-label="QR code to join on WhatsApp" shapeRendering="crispEdges"><rect width={q.size} height={q.size} fill="#fff"/><path d={q.path} fill="#111"/></svg>;
}

function JoinCard({pack,meta}:{pack:SatifyPack;meta:SatifyMeta|null}){
 const places=pack.scope_type==='route'?Object.entries(meta?.routes??{}):pack.scope_type==='city'?Object.entries(meta?.cities??{}):[];
 const [place,setPlace]=useState(places[0]?.[0]??'');
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

export function SatifyPage({packs,meta,initialCity,initialValues,badges}:{packs:SatifyPack[];meta:SatifyMeta|null;initialCity:string;initialValues:SatifyValue[];badges:Record<string,string>|null}){
 const [city,setCity]=useState(initialCity),[values,setValues]=useState(initialValues),[loading,setLoading]=useState(false);
 const byId=useMemo(()=>Object.fromEntries(values.map(v=>[v.id,v])),[values]);
 async function pick(c:string){setCity(c);setLoading(true);
  try{const r=await fetch(`/api/satify?what=now&city=${encodeURIComponent(c)}`);const j=await r.json();if(r.ok&&Array.isArray(j?.data))setValues(j.data);}catch{/* keep the last values */}finally{setLoading(false);}}
 const cities=Object.entries(meta?.cities??{lahore:'Lahore'});
 const groups=(meta?.groups??[]).map(g=>({...g,packs:packs.filter(p=>p.group_id===g.id)})).filter(g=>g.packs.length);
 return <div className="satify">
  <section className="satify-hero">
   <p className="satify-eyebrow">Satify</p>
   <h1>Satisfy yourself.</h1>
   <p className="satify-lead">Pakistan’s air, weather, fog, prices and alerts from satellites, sensors and official notices. Every number shows where it comes from and when, so you can check it yourself.</p>
   <div className="satify-legend">{(Object.keys(BADGE_TEXT) as SatifyValue['badge'][]).map(b=><span key={b}><Badge b={b}/> {badges?.[b]?.replace(/^[^(]*\(/,'').replace(/\)$/,'')??''}</span>)}</div>
  </section>
  <div className="satify-cities" role="tablist" aria-label="Choose a city">{cities.map(([k,l])=><button key={k} type="button" role="tab" aria-selected={city===k} className={`satify-pill${city===k?' satify-pill-on':''}`} onClick={()=>void pick(k)}>{l}</button>)}</div>
  <section className={`satify-strip${loading?' satify-loading':''}`} aria-label="Right now">{STRIP.map(id=><Value key={id} v={byId[id]} label={LABELS[id]??id} big/>)}</section>
  <div className="satify-sections">{SECTIONS.map(s=><section key={s.title} className="satify-card"><h2 className="satify-h2">{s.title}</h2>
   <div className="satify-grid">{s.ids.map(id=><Value key={id} v={byId[id]} label={LABELS[id]??id}/>)}</div>{s.note&&<p className="satify-muted">{s.note}</p>}</section>)}</div>
  <section className="satify-section" aria-labelledby="satify-packs"><h2 id="satify-packs" className="satify-h2">Join a pack on WhatsApp</h2>
   <p className="satify-muted">Useful alerts only: at most a couple of messages a day. Send STOP any time to leave.</p>
   {groups.map(g=><div key={g.id} className="satify-group"><h3 className="satify-h3">{g.name}</h3><div className="satify-packs">
    {g.packs.map(p=>p.card_type==='business'?<SchoolsCard key={p.slug} pack={p} meta={meta}/>:p.status==='live'?<JoinCard key={p.slug} pack={p} meta={meta}/>:<SoonCard key={p.slug} pack={p}/>)}
   </div></div>)}
   {!groups.length&&<p className="satify-muted">Packs will appear here shortly.</p>}
  </section>
 </div>;
}
