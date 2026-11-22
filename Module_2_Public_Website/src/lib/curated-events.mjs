/**
 * PCI verified factual event notices (not scraped listings or a live event feed).
 * Individually checked against primary organizers/venue documentation on 2026-11-22.
 * Minimal factual metadata with a direct source link; no copied descriptions.
 * Exact venue positions are documented separately in the release README.
 * Dates are local Pakistan calendar days; no unspecified start times are invented.
 * Invalidation: after end_at the notice vanishes automatically.
 */
export const CURATED_EVENTS_CHECKED_AT='2026-11-22';
export const CURATED_EVENTS=Object.freeze([
  Object.freeze({
    id:'pci-official-iapex27-2027-01-15',name:'IAPEX27 — Architecture & Building Materials Expo',
    start_at:'2027-01-15T00:00:00+05:00',end_at:'2027-01-18T00:00:00+05:00',all_day:true,
    city:'Islamabad',category:'expos',venue:'Pak-China Friendship Centre',
    latitude:33.69726,longitude:73.08298,
    description:'15–17 January 2027. Visit the organiser for opening times and current programme.',
    event_url:'https://www.iapex.pk/visit/faqs',organizer:'Institute of Architects Pakistan — RIC',
    ticket_type:'unknown',price_text:'',source_name:'IAPEX27 official organiser · checked 22 Nov 2026'
  }),
  Object.freeze({
    id:'pci-official-libf-2027-01-20',name:'40th Lahore International Book Fair 2027',
    start_at:'2027-01-20T00:00:00+05:00',end_at:'2027-01-25T00:00:00+05:00',all_day:true,
    city:'Lahore',category:'arts',venue:'Lahore International Expo Centre',
    latitude:31.464,longitude:74.259,
    description:'20–24 January 2027. Confirm admission and opening times with LIBF Trust.',
    event_url:'https://libftrust.com/about-us/about-the-event/',organizer:'Lahore International Book Fair Trust',
    ticket_type:'unknown',price_text:'',source_name:'LIBF Trust official announcement · checked 22 Nov 2026'
  }),
  Object.freeze({
    id:'pci-official-kibf-2026-12-17',name:'21st Karachi International Book Fair 2026',
    start_at:'2026-12-17T00:00:00+05:00',end_at:'2026-12-22T00:00:00+05:00',all_day:true,
    city:'Karachi',category:'arts',venue:'Karachi Expo Centre, Halls 1–3',
    latitude:24.90139,longitude:67.076083,
    description:'17–21 December 2026 according to TDAP venue booking schedule; confirm before travelling.',
    event_url:'https://tdap.gov.pk/wp-content/uploads/2025/07/Booking-Schedule-of-KEC_22_July.pdf',
    organizer:'Karachi International Book Fair',ticket_type:'unknown',price_text:'',
    source_name:'TDAP official venue booking schedule · checked 22 Nov 2026'
  })
]);

export function publishedCuratedEvents(now=Date.now()){
  return CURATED_EVENTS.filter(e=>{
    const from=Date.parse(e.start_at),to=Date.parse(e.end_at);
    const validDate=Number.isFinite(from)&&Number.isFinite(to)&&from<to&&to>now;
    const validLocation=Number.isFinite(e.latitude)&&Number.isFinite(e.longitude);
    const validSource=e.event_url.startsWith('https://')&&e.name&&e.venue;
    return validDate&&validLocation&&validSource;
  });
}

export function mergePublicEvents(fromBackend=[],now=Date.now()){
  const live=Array.isArray(fromBackend)?fromBackend:[];
  const out=[];const keys=new Set();
  for(const e of [...live,...publishedCuratedEvents(now)]){
    if(!e||typeof e!=='object')continue;
    // Actual approved backend records take precedence over the built-in notices.
    const key=`${String(e.city||'').toLowerCase()}|${String(e.name||'').toLowerCase().replace(/[^a-z0-9]/g,'')}|${String(e.start_at||'').slice(0,10)}`;
    if(keys.has(key))continue;
    keys.add(key);out.push(e);
  }
  return out.sort((a,b)=>Date.parse(a.start_at)-Date.parse(b.start_at));
}
