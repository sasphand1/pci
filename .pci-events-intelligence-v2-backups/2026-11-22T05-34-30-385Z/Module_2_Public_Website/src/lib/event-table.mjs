/** Pure, dependency-free filtering for approved public Events API rows. */
export const EVENT_CITIES=Object.freeze(['Karachi','Lahore','Islamabad']);
export const EVENT_CATEGORY_LABELS=Object.freeze({sports:'Sports',education:'Education & Learning',gaming:'Gaming & Esports',technology:'Technology & Innovation',business:'Business & Expos',arts:'Arts & Entertainment',community:'Community & Festivals'});

function safeUrl(value){
  if(typeof value!=='string')return null;
  try{const url=new URL(value);return url.protocol==='https:'?url.href:null;}catch{return null;}
}
export function normalizePublicEvents(data,now=Date.now()){
  if(!Array.isArray(data))return [];
  const seen=new Set();
  return data.flatMap((event,index)=>{
    if(!event||typeof event!=='object'||Array.isArray(event))return [];
    const name=typeof event.name==='string'?event.name.trim():'';
    const city=typeof event.city==='string'?event.city.trim():'';
    const start=Date.parse(event.start_at);
    const end=typeof event.end_at==='string'?Date.parse(event.end_at):start;
    // Ongoing multi-day events remain visible until they end.
    if(!name||!EVENT_CITIES.includes(city)||!Number.isFinite(start)||!Number.isFinite(end)||Math.max(start,end)<now)return [];
    const rawId=typeof event.id==='string'?event.id:String(index);
    const key=rawId+'|'+start;
    if(seen.has(key))return [];seen.add(key);
    const venue=typeof event.venue==='string'&&event.venue.trim()?event.venue.trim():'Not specified';
    const rawCategory=typeof event.category==='string'?event.category.toLowerCase().trim():'other';
    const category=rawCategory==='expos'?'business':rawCategory==='conferences'?'education':rawCategory;
    const admission=['free','paid'].includes(String(event.ticket_type).toLowerCase())?String(event.ticket_type).toLowerCase():'unknown';
    const lat=event.latitude===null||event.latitude===undefined?null:Number(event.latitude);
    const lng=event.longitude===null||event.longitude===undefined?null:Number(event.longitude);
    const hasCoordinates=lat!==null&&lng!==null&&Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=23&&lat<=38&&lng>=60&&lng<=78;
    return [{id:rawId,name,city,start_at:event.start_at,start_ms:start,end_ms:end,all_day:event.all_day===true,category,venue,
      admission,source_name:typeof event.source_name==='string'?event.source_name:'Official announcement',source_url:safeUrl(event.event_url),
      latitude:hasCoordinates?lat:null,longitude:hasCoordinates?lng:null}];
  }).sort((a,b)=>a.start_ms-b.start_ms||a.name.localeCompare(b.name));
}
export function filterPublicEvents(events,{city='all',category='all',window='all',search=''}={},now=Date.now()){
  const selectedCategory=category==='expos'?'business':category==='conferences'?'education':category;
  const cutoff=window==='week'?now+7*86400000:window==='month'?now+30*86400000:Infinity;
  const query=String(search).trim().toLocaleLowerCase('en');
  return events.filter(e=>
    (city==='all'||e.city===city)&&
    (selectedCategory==='all'||e.category===selectedCategory)&&
    e.start_ms<=cutoff&&e.end_ms>=now&&
    (!query||[e.name,e.city,e.venue,e.source_name].some(x=>x.toLocaleLowerCase('en').includes(query)))
  );
}
export function eventCategoryLabel(category){return EVENT_CATEGORY_LABELS[category]||category.replace(/\b\w/g,x=>x.toUpperCase());}
export function eventWazeUrl(event){return event.latitude!==null&&event.longitude!==null?`https://waze.com/ul?ll=${encodeURIComponent(`${event.latitude},${event.longitude}`)}&navigate=yes`:null;}
