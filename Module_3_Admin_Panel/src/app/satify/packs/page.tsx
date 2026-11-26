'use client';
import {useEffect,useMemo,useState} from 'react';
import {Card,Badge} from '@pci/ui';
import {AdminPage,DataBlock,Status,useData,RoleGate} from '@/components/Shared';
import {api,errorText} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';

type Rule={signal:string;op:'>='|'<='|'=='|'exists';value?:number|string;label?:string};
type Pack={slug:string;code:string;name:string;icon:string;group_id:string;sort_order:number;featured:boolean;status:string;card_type:'alert'|'business';tagline:string;bullets:string[];
 schedule_label:string;daily_at:string|null;price:'free'|'paid'|'business';scope_type:'city'|'route'|'national';languages:('en'|'ur')[];signals:string[];urgent_rules:Rule[];
 template:string;sponsor:string|null;cooldown_hours:number;max_per_day:number;cta_label:string|null};
type Signal={id:string;label:string;unit:string;scope:'city'|'pk'|'route';badge:string;source:string;optional?:boolean};
type Catalog={signals:Signal[];cities:Record<string,string>;routes:Record<string,{label:string}>;groups:{id:string;name:string}[];ops:string[]};
const EMPTY:Pack={slug:'',code:'',name:'',icon:'📡',group_id:'family',sort_order:100,featured:false,status:'draft',card_type:'alert',tagline:'',bullets:['','',''],schedule_label:'Daily 08:00 + urgent alerts',
 daily_at:'08:00',price:'free',scope_type:'city',languages:['en','ur'],signals:[],urgent_rules:[],template:'{city}\n',sponsor:null,cooldown_hours:6,max_per_day:2,cta_label:null};
const STATUS:[string,string][]=[['draft','Draft (hidden)'],['soon','Coming soon (shown greyed)'],['testing','Testing (hidden, test sends only)'],['live','Live'],['paused','Paused (hidden)']];

export default function PackBuilder(){
 const {identity}=useAuth();const csrf=identity?.csrfToken;
 const packs=useData<Pack[]>('/admin/satify/packs');const cat=useData<Catalog>('/admin/satify/catalog');
 const [sel,setSel]=useState<string|null>(null),[form,setForm]=useState<Pack>(EMPTY),[isNew,setIsNew]=useState(false);
 const [scope,setScope]=useState('lahore'),[phone,setPhone]=useState(''),[previewText,setPreview]=useState(''),[missing,setMissing]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState('');
 useEffect(()=>{if(!sel&&packs.data?.length){setSel(packs.data[0].slug);}},[packs.data,sel]);
 useEffect(()=>{const p=packs.data?.find(x=>x.slug===sel);if(p){setForm({...p,bullets:[...p.bullets,'','',''].slice(0,3),urgent_rules:Array.isArray(p.urgent_rules)?p.urgent_rules:[]});setIsNew(false);setPreview('');setMissing([]);}},[sel,packs.data]);
 const set=<K extends keyof Pack>(k:K,v:Pack[K])=>setForm(f=>({...f,[k]:v}));
 const usable=useMemo(()=>(cat.data?.signals??[]).filter(s=>s.scope==='pk'||(form.scope_type==='city'&&s.scope==='city')||(form.scope_type==='route'&&s.scope==='route')),[cat.data,form.scope_type]);
 const places=form.scope_type==='route'?Object.entries(cat.data?.routes??{}).map(([k,v])=>[k,v.label]):form.scope_type==='national'?[['pk','Pakistan']]:Object.entries(cat.data?.cities??{});
 useEffect(()=>{if(places.length&&!places.some(([k])=>k===scope))setScope(String(places[0][0]));},[form.scope_type,places,scope]);
 const body=()=>({...form,bullets:form.bullets.map(b=>b.trim()).filter(Boolean),sponsor:form.sponsor?.trim()||null,cta_label:form.cta_label?.trim()||null,daily_at:form.daily_at||null,
  urgent_rules:form.urgent_rules.map(r=>r.op==='exists'?{signal:r.signal,op:r.op,label:r.label??''}:{...r,value:r.op==='=='?String(r.value??''):Number(r.value)})});
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setOk('');
  try{const b=body();
   if(isNew)await api('/admin/satify/packs',{method:'POST',csrf,body:b});else await api(`/admin/satify/packs/${form.slug}`,{method:'PUT',csrf,body:b});
   setOk(form.status==='live'?`${form.name} is live. Its card, join code JOIN ${form.code} and QR code now appear on the Satify page automatically.`:`${form.name} saved.`);
   setSel(form.slug);packs.reload();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 async function doPreview(){setError('');try{const r=await api<{body:string;missing:string[]}>(`/admin/satify/packs/${form.slug}/preview`,{method:'POST',csrf,body:{scope}});setPreview(r.body);setMissing(r.missing);}catch(e){setError(errorText(e));}}
 async function doTest(){setBusy(true);setError('');setOk('');try{const r=await api<{status:string;error:string|null;body:string;missing:string[]}>(`/admin/satify/packs/${form.slug}/test`,{method:'POST',csrf,body:{scope,phone},timeoutMs:30000});
  setPreview(r.body);setMissing(r.missing);setOk(r.status==='sent'?'Test message sent to your WhatsApp.':r.status==='dry_run'?'WhatsApp is not configured yet, so the test was only logged. The message is shown below.':`Test failed: ${r.error}`);}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 async function sendNow(){if(!confirm(`Send this ${form.name} message now to every subscriber in ${scope}?`))return;setBusy(true);setError('');setOk('');
  try{const r=await api<{recipients:number}>(`/admin/satify/packs/${form.slug}/send-now`,{method:'POST',csrf,body:{scope},timeoutMs:60000});setOk(`Sent to ${r.recipients} subscribers (or logged, in dry-run mode).`);}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 const toggleSignal=(id:string)=>set('signals',form.signals.includes(id)?form.signals.filter(s=>s!==id):[...form.signals,id]);
 const insert=(id:string)=>set('template',`${form.template}{${id}}`);
 const rule=(i:number,patch:Partial<Rule>)=>set('urgent_rules',form.urgent_rules.map((r,j)=>j===i?{...r,...patch}:r));
 return <RoleGate roles={['owner','editor']}><AdminPage title="Satify packs" description="Build a pack once here: its website card, join code, QR code, WhatsApp messages, schedule and urgent alerts all wire up automatically. No code needed."
  action={<><button className="btn btn-secondary" onClick={()=>packs.reload()}>Reload</button><button className="btn btn-primary" onClick={()=>{setSel(null);setForm({...EMPTY,bullets:['','','']});setIsNew(true);setPreview('');}}>New pack</button></>}>
  <Status error={error} ok={ok}/>
  <DataBlock loading={packs.loading||cat.loading} error={packs.error||cat.error} empty={!packs.data||!cat.data}>{packs.data&&cat.data&&<>
   <Card><div className="admin-inline-actions satify-wrap">{packs.data.map(p=><button key={p.slug} type="button" className={`btn ${p.slug===sel&&!isNew?'btn-primary':'btn-secondary'}`} onClick={()=>setSel(p.slug)}>{p.icon} {p.name} {p.status==='live'?'●':''}</button>)}</div></Card>
   <form className="form" onSubmit={save}>
    <Card><h2 className="admin-box-title">1 · Card</h2><div className="admin-form-grid">
     <div className="field"><label>Name</label><input required maxLength={60} value={form.name} onChange={e=>set('name',e.target.value)}/></div>
     <div className="field"><label>Join code (JOIN …)</label><input required pattern="[A-Z0-9]{2,20}" value={form.code} onChange={e=>set('code',e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))}/></div>
     <div className="field"><label>Web address id</label><input required pattern="[a-z0-9-]{2,40}" disabled={!isNew} value={form.slug} onChange={e=>set('slug',e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))}/></div>
     <div className="field"><label>Icon</label><input maxLength={8} value={form.icon} onChange={e=>set('icon',e.target.value)}/></div>
     <div className="field admin-form-wide"><label>One line</label><input maxLength={120} value={form.tagline} onChange={e=>set('tagline',e.target.value)}/></div>
     {form.bullets.map((b,i)=><div key={i} className="field admin-form-wide"><label>Point {i+1}</label><input maxLength={90} value={b} onChange={e=>set('bullets',form.bullets.map((x,j)=>j===i?e.target.value:x))}/></div>)}
     <div className="field"><label>Group</label><select value={form.group_id} onChange={e=>set('group_id',e.target.value)}>{cat.data.groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
     <div className="field"><label>Order</label><input type="number" min={0} max={999} value={form.sort_order} onChange={e=>set('sort_order',Number(e.target.value))}/></div>
     <div className="field"><label><input type="checkbox" checked={form.featured} onChange={e=>set('featured',e.target.checked)}/> Featured (shown first, with QR)</label></div>
     <div className="field"><label>Card type</label><select value={form.card_type} onChange={e=>set('card_type',e.target.value as Pack['card_type'])}><option value="alert">WhatsApp alert pack</option><option value="business">Business box (e.g. schools form)</option></select></div>
    </div></Card>
    <Card><h2 className="admin-box-title">2 · Audience</h2><div className="admin-form-grid">
     <div className="field"><label>People choose</label><select value={form.scope_type} onChange={e=>set('scope_type',e.target.value as Pack['scope_type'])}><option value="city">a city</option><option value="route">a motorway route</option><option value="national">nothing (whole Pakistan)</option></select></div>
     <div className="field"><label>Languages</label><select multiple value={form.languages} onChange={e=>set('languages',[...e.target.selectedOptions].map(o=>o.value as 'en'|'ur'))}><option value="en">English</option><option value="ur">Urdu</option></select></div>
    </div></Card>
    {form.card_type==='alert'&&<Card><h2 className="admin-box-title">3 · Data (a message is held back if a required item is missing or stale)</h2>
     <div className="admin-form-grid">{usable.map(s=><label key={s.id} className="field"><span><input type="checkbox" checked={form.signals.includes(s.id)} onChange={()=>toggleSignal(s.id)}/> {s.label} <Badge variant="muted">{s.badge}</Badge>{s.optional&&<> <Badge variant="muted">optional</Badge></>}</span><span className="field-hint">{`{${s.id}}`} · {s.source}</span></label>)}</div>
    </Card>}
    {form.card_type==='alert'&&<Card><h2 className="admin-box-title">4 · Rules</h2><div className="admin-form-grid">
     <div className="field"><label>Daily message at (Pakistan time)</label><input type="time" value={form.daily_at??''} onChange={e=>set('daily_at',e.target.value||null)}/></div>
     <div className="field"><label>Schedule text on the card</label><input maxLength={60} value={form.schedule_label} onChange={e=>set('schedule_label',e.target.value)}/></div>
     <div className="field"><label>Cooldown between urgent alerts (hours)</label><input type="number" min={1} max={72} value={form.cooldown_hours} onChange={e=>set('cooldown_hours',Number(e.target.value))}/></div>
     <div className="field"><label>Most messages per day</label><input type="number" min={1} max={6} value={form.max_per_day} onChange={e=>set('max_per_day',Number(e.target.value))}/></div>
    </div>
     <h3 className="admin-box-title">Urgent alerts</h3>
     {form.urgent_rules.map((r,i)=><div key={i} className="admin-form-grid">
      <div className="field"><label>When</label><select value={r.signal} onChange={e=>rule(i,{signal:e.target.value})}>{usable.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
      <div className="field"><label>Is</label><select value={r.op} onChange={e=>rule(i,{op:e.target.value as Rule['op']})}><option value=">=">at least</option><option value="<=">at most</option><option value="==">exactly</option><option value="exists">entered / present</option></select></div>
      {r.op!=='exists'&&<div className="field"><label>Value</label><input value={String(r.value??'')} onChange={e=>rule(i,{value:e.target.value})}/></div>}
      <div className="field"><label>Alert headline</label><input maxLength={80} value={r.label??''} onChange={e=>rule(i,{label:e.target.value})}/></div>
      <div className="field"><button type="button" className="btn btn-secondary" onClick={()=>set('urgent_rules',form.urgent_rules.filter((_,j)=>j!==i))}>Remove</button></div>
     </div>)}
     <div className="admin-inline-actions"><button type="button" className="btn btn-secondary" disabled={form.urgent_rules.length>=5||!usable.length} onClick={()=>set('urgent_rules',[...form.urgent_rules,{signal:usable[0]?.id??'',op:'>=',value:0,label:''}])}>Add urgent alert</button></div>
    </Card>}
    {form.card_type==='alert'&&<Card><h2 className="admin-box-title">5 · Message</h2>
     <div className="field"><label>Template ({'{city}'} / {'{route}'} = the place)</label><textarea rows={7} maxLength={1200} value={form.template} onChange={e=>set('template',e.target.value)}/></div>
     <div className="admin-inline-actions satify-wrap">{form.signals.map(id=><button key={id} type="button" className="btn btn-secondary" onClick={()=>insert(id)}>+ {id}</button>)}</div>
     <p className="fineprint">Satify adds the sponsor line and “Reply STOP {form.code||'CODE'}” automatically.</p>
     {!isNew&&<><div className="admin-form-grid">
      <div className="field"><label>Preview for</label><select value={scope} onChange={e=>setScope(e.target.value)}>{places.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></div>
      <div className="field"><label>Your WhatsApp number (for a test)</label><input value={phone} placeholder="0300 1234567" onChange={e=>setPhone(e.target.value)}/></div>
     </div><div className="admin-inline-actions">
      <button type="button" className="btn btn-secondary" onClick={()=>void doPreview()}>Preview with today’s data</button>
      <button type="button" className="btn btn-secondary" disabled={busy||!phone} onClick={()=>void doTest()}>Send test to me</button>
      <button type="button" className="btn btn-secondary" disabled={busy||form.status!=='live'} onClick={()=>void sendNow()}>Send now to this place</button>
     </div><p className="fineprint">Preview and test use the saved pack: save first after changes.</p></>}
     {previewText&&<pre className="satify-pre">{previewText}</pre>}
     {missing.length>0&&<p role="alert">Would be held back right now. Missing or stale: {missing.join(', ')}</p>}
    </Card>}
    <Card><h2 className="admin-box-title">6 · Business</h2><div className="admin-form-grid">
     <div className="field"><label>Status</label><select value={form.status} onChange={e=>set('status',e.target.value)}>{STATUS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
     <div className="field"><label>Price</label><select value={form.price} onChange={e=>set('price',e.target.value as Pack['price'])}><option value="free">Free</option><option value="paid">Paid</option><option value="business">For schools / business</option></select></div>
     <div className="field admin-form-wide"><label>Sponsor line (optional)</label><input maxLength={120} value={form.sponsor??''} placeholder="Sponsored by …" onChange={e=>set('sponsor',e.target.value)}/></div>
     {form.card_type==='business'&&<div className="field"><label>Button text</label><input maxLength={40} value={form.cta_label??''} onChange={e=>set('cta_label',e.target.value)}/></div>}
    </div><div className="admin-inline-actions"><button className="btn btn-primary" type="submit" disabled={busy}>{busy?'Saving…':isNew?'Create pack':'Save pack'}</button></div></Card>
   </form>
  </>}</DataBlock>
 </AdminPage></RoleGate>;
}
