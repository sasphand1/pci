'use client';
import {useState} from 'react';
import {Card,Badge} from '@pci/ui';
import {AdminPage,DataBlock,Status,TableWrap,useData,RoleGate,ConfirmButton} from '@/components/Shared';
import {api,errorText,fmtDate} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';
import {RestaurantImages} from './restaurant-images';

type City='karachi'|'lahore'|'islamabad';
type Override={placeId:string;city:City;mode:'pick'|'hide';note:string|null;name:string;addedAt:string;rating:number|null;reviewCount:number|null;asOf:string|null;mapsUrl:string|null};
type Run={startedAt:string;finishedAt:string|null;requests:number;found:number;kept:number;result:string};
type LocalStatus={keyConfigured:boolean;autofill:boolean;overrides:Override[];runs:Run[];cities:{city:string;places:number;fresh:number;newest:string|null}[]};
type Candidate={placeId:string;name:string;address:string|null;rating:number|null;reviewCount:number|null;mapsUrl:string|null};
const CITIES:[City,string][]=[['karachi','Karachi'],['lahore','Lahore'],['islamabad','Islamabad']];
const cityLabel=(c:string)=>CITIES.find(x=>x[0]===c)?.[1]??c;

export default function LocalRestaurantsPage(){
 const {identity}=useAuth();const csrf=identity?.csrfToken;
 const status=useData<LocalStatus>('/admin/local/status');
 const [city,setCity]=useState<City>('lahore'),[input,setInput]=useState(''),[note,setNote]=useState('');
 const [found,setFound]=useState<Candidate[]|null>(null),[phrase,setPhrase]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState('');
 const s=status.data;
 async function search(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setOk('');setFound(null);
  try{const r=await api<{phrase:string;candidates:Candidate[]}>('/admin/local/search',{method:'POST',csrf,body:{input,city},timeoutMs:30000});setFound(r.candidates);setPhrase(r.phrase);if(!r.candidates.length)setError('Google found no restaurant for that. Try the full name or add the area.');}
  catch(e){setError(errorText(e));}finally{setBusy(false);}}
 async function save(c:Candidate,mode:'pick'|'hide'){setBusy(true);setError('');setOk('');
  try{await api('/admin/local/places',{method:'POST',csrf,body:{placeId:c.placeId,city,mode,...(note.trim()?{note:note.trim()}:{})},timeoutMs:30000});
   setOk(mode==='pick'?`${c.name} added to Our picks for ${cityLabel(city)}.`:`${c.name} hidden from the ${cityLabel(city)} list.`);setFound(null);setInput('');setNote('');status.reload();}
  catch(e){setError(errorText(e));}finally{setBusy(false);}}
 async function remove(o:Override){setError('');setOk('');try{await api(`/admin/local/places/${encodeURIComponent(o.placeId)}`,{method:'DELETE',csrf});setOk(`${o.name} is back to automatic ranking.`);status.reload();}catch(e){setError(errorText(e));}}
 async function collect(){setBusy(true);setError('');setOk('');
  try{const r=await api<{status:string;reason?:string;requests:number;found:number;kept:number}>('/admin/ingest/local/collect',{method:'POST',csrf,body:{},timeoutMs:120000});
   setOk(r.status==='skipped'?`Collection skipped: ${(r.reason??'').replace(/_/g,' ')}.`:`Collection finished: ${r.requests} Google requests, ${r.found} places seen, ${r.kept} stored.`);status.reload();}
  catch(e){setError(errorText(e));}finally{setBusy(false);}}
 return <RoleGate roles={['owner','editor']}><AdminPage title="Restaurants" description="The website's Top 20 per city is collected automatically from Google ratings. Here you can add Our picks, hide places that should not appear, and run a collection."
  action={<><button className="btn btn-secondary" onClick={()=>status.reload()}>Reload</button><button className="btn btn-primary" disabled={busy||!s?.keyConfigured} onClick={()=>void collect()}>{busy?'Working…':'Collect now'}</button></>}>
  <Status error={error} ok={ok}/>
  <RestaurantImages csrf={csrf}/>
  <DataBlock loading={status.loading} error={status.error} empty={!s}>{s&&<>
   {!s.keyConfigured&&<Card><p role="alert">GOOGLE_PLACES_API_KEY is not set on Module 1, so nothing can be collected or looked up yet.</p></Card>}
   <div className="admin-panel-grid">
    <Card><h2 className="admin-box-title">Add a pick or hide a place</h2>
     <form className="form" onSubmit={search}><div className="admin-form-grid">
      <div className="field"><label htmlFor="r-city">City</label><select id="r-city" value={city} onChange={e=>setCity(e.target.value as City)}>{CITIES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
      <div className="field admin-form-wide"><label htmlFor="r-input">Google Maps link or restaurant name</label><input id="r-input" required minLength={2} maxLength={500} value={input} onChange={e=>setInput(e.target.value)} placeholder="Paste a Google Maps share link, or type the name"/><span className="field-hint">In Google Maps open the place, tap Share and paste the link. Short links work too.</span></div>
      <div className="field admin-form-wide"><label htmlFor="r-note">Short note (optional, shown on the website)</label><input id="r-note" maxLength={200} value={note} onChange={e=>setNote(e.target.value)} placeholder="Famous for nihari and paya"/></div>
     </div><div className="admin-inline-actions"><button className="btn btn-primary" type="submit" disabled={busy||!s.keyConfigured}>{busy?'Searching…':'Find restaurant'}</button></div></form>
    </Card>
    <Card><h2 className="admin-box-title">How it works</h2>
     <p className="muted"><strong>Our picks</strong> appear in their own row with a badge and never change the numbered ranking.</p>
     <p className="muted"><strong>Hide</strong> removes a place (closed, duplicate, not suitable) from the automatic Top 20.</p>
     <p className="muted">Ratings and review counts come from Google and are refreshed every Monday. Entries older than 30 days stop showing. Automatic collection is {s.autofill?'on':'off'}.</p>
    </Card>
   </div>
   {found&&found.length>0&&<Card><h2 className="admin-box-title">Pick the right restaurant{phrase?` for “${phrase}”`:''} in {cityLabel(city)}</h2>
    <TableWrap><thead><tr><th>Restaurant</th><th>Address</th><th>Rating</th><th>Action</th></tr></thead><tbody>{found.map(c=><tr key={c.placeId}><td>{c.name}</td><td>{c.address??'—'}</td><td>{c.rating===null?'Not available':`${c.rating} (${c.reviewCount??0} reviews)`}</td>
     <td><div className="admin-inline-actions"><button className="btn btn-primary" disabled={busy} onClick={()=>void save(c,'pick')}>Add to Our picks</button><button className="btn btn-secondary" disabled={busy} onClick={()=>void save(c,'hide')}>Hide</button></div></td></tr>)}</tbody></TableWrap></Card>}
   <Card><h2 className="admin-box-title">Your picks and hidden places</h2>
    {!s.overrides.length?<p className="muted">Nothing yet. Everything on the website is ranked automatically.</p>:
    <TableWrap><thead><tr><th>Restaurant</th><th>City</th><th>Status</th><th>Rating</th><th>Updated</th><th>Action</th></tr></thead><tbody>{s.overrides.map(o=><tr key={o.placeId}>
     <td>{o.mapsUrl?<a href={o.mapsUrl} target="_blank" rel="noopener noreferrer">{o.name}</a>:o.name}{o.note&&<div className="fineprint">{o.note}</div>}</td><td>{cityLabel(o.city)}</td>
     <td><Badge variant={o.mode==='pick'?'normal':'danger'}>{o.mode==='pick'?'Our pick':'Hidden'}</Badge></td>
     <td>{o.rating===null?'Not available':`${o.rating} (${o.reviewCount??0})`}</td><td>{fmtDate(o.asOf)}</td>
     <td><ConfirmButton label="Remove" variant="secondary" confirmText={`Remove the override for ${o.name}? It returns to automatic ranking.`} onConfirm={()=>remove(o)}/></td></tr>)}</tbody></TableWrap>}
   </Card>
   <div className="admin-panel-grid">
    <Card><h2 className="admin-box-title">Collected places</h2>
     {!s.cities.length?<p className="muted">No places collected yet. Press “Collect now” once the Google key is set.</p>:
     <TableWrap><thead><tr><th>City</th><th>Places stored</th><th>Fresh (30 days)</th><th>Newest</th></tr></thead><tbody>{s.cities.map(c=><tr key={c.city}><td>{cityLabel(c.city)}</td><td>{c.places}</td><td>{c.fresh}</td><td>{fmtDate(c.newest)}</td></tr>)}</tbody></TableWrap>}
    </Card>
    <Card><h2 className="admin-box-title">Recent collections</h2>
     {!s.runs.length?<p className="muted">No collections yet.</p>:
     <TableWrap><thead><tr><th>Started</th><th>Google requests</th><th>Seen</th><th>Stored</th><th>Result</th></tr></thead><tbody>{s.runs.map((r,i)=><tr key={i}><td>{fmtDate(r.startedAt)}</td><td>{r.requests}</td><td>{r.found}</td><td>{r.kept}</td><td><Badge variant={r.result==='done'?'normal':'danger'}>{r.result}</Badge></td></tr>)}</tbody></TableWrap>}
    </Card>
   </div></>}
  </DataBlock>
 </AdminPage></RoleGate>;
}
