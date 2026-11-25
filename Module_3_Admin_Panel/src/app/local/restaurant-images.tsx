'use client';
import {useState} from 'react';
import {Card} from '@pci/ui';
import {api,errorText,fmtDate} from '@/lib/api';
import {Status,useData} from '@/components/Shared';

type PhotoRow={placeId:string;name:string;city:string;area:string|null;sourceUrl:string|null;permissionUrl:string|null;attribution:string|null;licence:string|null;sizeBytes:number|null;fetchedAt:string|null;candidates?:Candidate[];discoveryStatus?:string|null;diagnostics?:string[]};
type Candidate={title:string;sourceUrl:string;permissionUrl:string;attribution:string;licence:string;licenceUrl:string|null;origin?:string;sourcePage?:string};
export function RestaurantImages({csrf}:{csrf?:string}){
 const state=useData<PhotoRow[]>('/admin/local/images');const rows=state.data??[];
 const [placeId,setPlaceId]=useState(''),[sourceUrl,setSource]=useState(''),[permissionUrl,setPermission]=useState(''),[attribution,setAttribution]=useState(''),[licence,setLicence]=useState('');
 const [mode,setMode]=useState<'direct'|'page'>('direct'),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState('');
 const [candidates,setCandidates]=useState<Candidate[]>([]),[website,setWebsite]=useState(''),[diagnostics,setDiagnostics]=useState<string[]>([]);
 const selected=rows.find(r=>r.placeId===placeId);
 const choose=(id:string)=>{setPlaceId(id);setCandidates(rows.find(r=>r.placeId===id)?.candidates??[]);setConfirmed(false);setWebsite('');setDiagnostics(rows.find(r=>r.placeId===id)?.diagnostics??[]);setMode('direct');setSource('');setPermission('');setAttribution('');setLicence('');setOk('');setError('');};
 const task=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');setOk('');try{await fn();}catch(e){setError(errorText(e));}finally{setBusy(false);}};
 const discover=()=>task(async()=>{setCandidates([]);const r=await api<{candidates:Candidate[];diagnostics:string[];status:string}>('/admin/local/images/discover',{method:'POST',csrf,body:{placeId,...(website.trim()?{website:website.trim()}:{})},timeoutMs:45000});setCandidates(r.candidates);setDiagnostics(r.diagnostics);setOk(r.candidates.length?`${r.candidates.length} candidates found. Verify identity and rights.`:'No suitable image candidate found. See source diagnostics.');state.reload();});
 const batch=()=>task(async()=>{const r=await api<{checked:number;found:number;failed:number}>('/admin/local/images/discover-batch',{method:'POST',csrf,body:{},timeoutMs:45000});setOk(`Checked ${r.checked}; ${r.found} with candidates; ${r.failed} failed. Select a restaurant to review its candidates.`);state.reload();});
 const save=()=>task(async()=>{await api('/admin/local/images',{method:'POST',csrf,body:{placeId,sourceUrl,permissionUrl,attribution,licence,mode,confirmed},timeoutMs:35000});setOk('Verified source saved to Neon.');setConfirmed(false);state.reload();});
 const remove=()=>{if(!window.confirm('Remove this restaurant photo?'))return;void task(async()=>{await api(`/admin/local/images/${encodeURIComponent(placeId)}`,{method:'DELETE',csrf});setOk('Photo removed.');state.reload();});};
 return <Card><h2 className="admin-box-title">Restaurant photographs (HTTP)</h2>
 <p className="muted">{rows.filter(r=>r.fetchedAt).length} of {rows.length} stored restaurants have approved photos. No Google Photos API requests.</p>
 <Status error={error} ok={ok}/><div className="admin-inline-actions"><button type="button" className="btn btn-secondary" disabled={busy||state.loading||!csrf} onClick={()=>void batch()}>Discover next 5 restaurants</button></div>{state.error&&<p role="alert">Image status unavailable. Check Module 1 deployment.</p>}
 <div className="form"><div className="field"><label htmlFor="photo-place">Restaurant / exact branch</label><select id="photo-place" value={placeId} disabled={busy||state.loading} onChange={e=>choose(e.target.value)}><option value="">Choose a restaurant…</option>{rows.map(r=><option value={r.placeId} key={r.placeId}>{r.name} — {r.city}{r.area?` / ${r.area}`:''}{r.fetchedAt?' ✓':r.candidates?.length?` (${r.candidates.length} candidates)`:''}</option>)}</select></div>
 {selected&&<><p className="fineprint">{selected.fetchedAt?`Stored: ${fmtDate(selected.fetchedAt)} (${selected.sizeBytes} bytes). ${selected.attribution} · ${selected.licence}`:'No approved photograph.'} {selected.permissionUrl&&<a href={selected.permissionUrl} target="_blank" rel="noreferrer">Current source / permission</a>}</p>
 <div className="admin-inline-actions"><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>void discover()}>Find website / Commons candidates</button>{selected.fetchedAt&&<button type="button" className="btn btn-secondary" disabled={busy} onClick={remove}>Remove photo</button>}</div>
 <div className="field"><label htmlFor="photo-website">Optional official website URL for discovery</label><input id="photo-website" type="url" value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://restaurant.example/"/></div>
 {diagnostics.length>0&&<ul className="fineprint">{diagnostics.map((d,i)=><li key={i}>{d}</li>)}</ul>}
 {candidates.map(c=><div key={c.sourceUrl} className="field"><span>{c.title} — {c.origin??"Wikimedia Commons"} — {c.licence||"Rights not verified"} — {c.attribution}</span><a href={c.sourceUrl} target="_blank" rel="noreferrer">Inspect exact image</a>{c.sourcePage&&<a href={c.sourcePage} target="_blank" rel="noreferrer">Inspect source website</a>}{c.permissionUrl&&<a href={c.permissionUrl} target="_blank" rel="noreferrer">Inspect original file and licence</a>}<button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>{setSource(c.sourceUrl);setPermission(c.permissionUrl);setAttribution(c.attribution);setLicence(c.licence);setMode('direct');setConfirmed(false);}}>Use candidate</button></div>)}
 <form className="form" onSubmit={e=>{e.preventDefault();void save();}}>
 <div className="field"><label htmlFor="photo-mode">Source type</label><select id="photo-mode" value={mode} onChange={e=>{setMode(e.target.value as 'direct'|'page');setConfirmed(false);}}><option value="direct">Direct authorized image URL</option><option value="page">Authorized webpage (single unambiguous image)</option></select></div>
 <div className="field"><label htmlFor="photo-source">Source HTTPS URL</label><input id="photo-source" type="url" required value={sourceUrl} onChange={e=>{setSource(e.target.value);setConfirmed(false);}}/></div>
 <div className="field"><label htmlFor="photo-permission">Permission evidence / original licence page URL</label><input id="photo-permission" type="url" required value={permissionUrl} onChange={e=>{setPermission(e.target.value);setConfirmed(false);}}/></div>
 <div className="field"><label htmlFor="photo-credit">Photographer / rights holder attribution</label><input id="photo-credit" required maxLength={500} value={attribution} onChange={e=>{setAttribution(e.target.value);setConfirmed(false);}}/></div>
 <div className="field"><label htmlFor="photo-licence">Licence or documented permission</label><input id="photo-licence" required maxLength={150} value={licence} onChange={e=>{setLicence(e.target.value);setConfirmed(false);}} placeholder="CC BY 4.0 / written commercial-use permission"/></div>
 <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I inspected the exact photograph, verified this restaurant branch, and have permission to download, store and display it commercially with the stated credit.</label>
 <p className="fineprint">Prefer discovery and select the exact image URL. Ambiguous webpages are rejected. Only JPEG, PNG and WebP up to 200 KB are accepted. Redirects are not followed.</p>
 <button type="submit" className="btn btn-primary" disabled={busy||!confirmed||!csrf}>{busy?'Working…':'Download and save photo'}</button>
 </form></>}
 </div></Card>;
}
