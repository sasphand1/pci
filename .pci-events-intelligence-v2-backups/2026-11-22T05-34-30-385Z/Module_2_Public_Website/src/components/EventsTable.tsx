'use client';

import {useEffect,useMemo,useState} from 'react';
import {EVENT_CITIES,normalizePublicEvents,filterPublicEvents,eventCategoryLabel,eventWazeUrl,type PublicEventRow} from '@/lib/event-table.mjs';

type WindowFilter='all'|'week'|'month';
const DATE_OPTIONS:[WindowFilter,string][]= [['all','All events'],['week','Next 7 days'],['month','Next 30 days']];

function displayEventDate(event:PublicEventRow){
  const start=new Date(event.start_ms);
  const day=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Karachi'}).format(start);
  if(event.all_day)return <><strong>{day}</strong><small>Day / time: see organiser</small></>;
  const time=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:true,timeZone:'Asia/Karachi'}).format(start);
  return <><strong>{day}</strong><small>{time} PKT</small></>;
}

export function EventsTable(){
  const [events,setEvents]=useState<PublicEventRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);
  const [city,setCity]=useState('all');
  const [category,setCategory]=useState('all');
  const [windowFilter,setWindowFilter]=useState<WindowFilter>('all');
  const [search,setSearch]=useState('');
  const [updatedAt,setUpdatedAt]=useState(Date.now());
  useEffect(()=>{
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),8500);
    async function load(){
      try{
        const response=await fetch('/api/events',{headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal});
        if(!response.ok)throw new Error(`Events API ${response.status}`);
        const json:unknown=await response.json();
        if(!json||typeof json!=='object'||!('data' in json)||!Array.isArray(json.data))throw new Error('Invalid Events API response');
        if(controller.signal.aborted)return;
        setEvents(normalizePublicEvents(json.data));setUpdatedAt(Date.now());setError(false);
      }catch{if(!controller.signal.aborted){setError(true);setEvents([]);}}
      finally{if(!controller.signal.aborted)setLoading(false);}
    }
    void load();
    return()=>{clearTimeout(timeout);controller.abort();};
  },[]);
  const categories=useMemo(()=>['sports','education','gaming','technology','business','arts','community'],[]);
  const filtered=useMemo(()=>filterPublicEvents(events,{city,category,window:windowFilter,search},updatedAt),[events,city,category,windowFilter,search,updatedAt]);
  const clear=()=>{setCity('all');setCategory('all');setWindowFilter('all');setSearch('');};

  return <section className="pci-events-table-section" id="upcoming-events" aria-label="Upcoming events table">
    <div className="container">
      <div className="pci-events-table-heading">
        <div><h2>Upcoming Events</h2><p>Browse published events in date order. Every row links to its original announcement.</p></div>
        <span className="pci-events-table-total" aria-live="polite">{loading?'Loading…':`${filtered.length} ${filtered.length===1?'event':'events'}`}</span>
      </div>
      <div className="pci-events-table-filters" role="group" aria-label="Filter events by date">
        {DATE_OPTIONS.map(([value,label])=><button key={value} type="button" className={windowFilter===value?'is-active':''} aria-pressed={windowFilter===value} onClick={()=>setWindowFilter(value)}>{label}</button>)}
        <label className="pci-events-filter-select"><span>City</span><select value={city} onChange={e=>setCity(e.target.value)} aria-label="Filter events by city"><option value="all">All cities</option>{EVENT_CITIES.map(x=><option value={x} key={x}>{x}</option>)}</select></label>
        <label className="pci-events-filter-select"><span>Category</span><select value={category} onChange={e=>setCategory(e.target.value)} aria-label="Filter events by category"><option value="all">All categories</option>{categories.map(x=><option value={x} key={x}>{eventCategoryLabel(x)}</option>)}</select></label>
        <label className="pci-events-filter-search"><span className="sr-only">Search event or venue</span><input type="search" placeholder="Search events or venues…" value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search event or venue" /></label>
      </div>
      <div className="pci-events-table-wrap" tabIndex={0} role="region" aria-label="Numbered event listings" >
        <table className="pci-events-list-table"><thead><tr><th scope="col">#</th><th scope="col">Event</th><th scope="col">City</th><th scope="col">Date (PKT)</th><th scope="col">Venue</th><th scope="col">Category</th><th scope="col">Admission</th><th scope="col">Details</th></tr></thead>
          <tbody>
            {filtered.map((event,index)=><tr key={`${event.id}-${event.start_ms}`}>
              <td className="pci-event-number">{index+1}</td>
              <td className="pci-event-name"><strong>{event.name}</strong><small>{event.source_name}</small></td>
              <td>{event.city}</td>
              <td className="pci-event-date">{displayEventDate(event)}</td>
              <td>{event.venue}</td>
              <td><span className="pci-event-category">{eventCategoryLabel(event.category)}</span></td>
              <td><span className={`pci-event-admission pci-event-admission-${event.admission}`}>{event.admission==='unknown'?'Check organiser':event.admission==='free'?'Free':'Paid'}</span></td>
              <td className="pci-event-links">{event.source_url?<a href={event.source_url} target="_blank" rel="noopener noreferrer">Source</a>:<span>Not available</span>}{eventWazeUrl(event)&&<a href={eventWazeUrl(event)!} target="_blank" rel="noopener noreferrer">Directions</a>}</td>
            </tr>)}
          </tbody>
        </table>
        <div className="pci-events-table-empty" role="status" hidden={filtered.length>0}>
          {loading?'Loading published events…':error?'Event data is temporarily unavailable. Please try again later.':events.length?'No events match these filters.':'No verified upcoming events are currently available.'}
          {!loading&&!error&&events.length>0&&<button type="button" onClick={clear}>Clear filters</button>}
        </div>
      </div>
      <p className="pci-events-table-footnote">Events are sorted by announced date, not ranked. Times and ticket information are shown only when supplied by the source. All dates use Pakistan time (PKT). Verify details with the organiser before travelling.</p>
    </div>
  </section>;
}
