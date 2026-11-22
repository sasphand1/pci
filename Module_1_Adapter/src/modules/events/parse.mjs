/* Conservative parsing: never turn article publication dates into event dates. */
import {createHash} from 'node:crypto';

export const CITIES=['Karachi','Lahore','Islamabad'];
export const CATEGORIES=['sports','education','gaming','technology','business','arts','community','expos','conferences'];
export function validateHttpsUrl(value){
  if(typeof value!=='string'||value.length>1900)throw new Error('Invalid feed URL');
  let u;try{u=new URL(value);}catch{throw new Error('Invalid feed URL');}
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!u.hostname.includes('.')||u.hostname.endsWith('.local')||u.hostname.endsWith('.internal')||u.hostname.endsWith('.localhost'))throw new Error('Only public HTTPS feed URLs without credentials, ports or fragments are supported');
  if(/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)||u.hostname.startsWith('[')||/^(localhost|metadata|ip6-localhost|host\.docker\.internal)$/i.test(u.hostname))throw new Error('IP/localhost URLs are not allowed');
  return u.href;
}
const clean=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
function entities(s){return String(s??'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos|nbsp);/gi,(m,n,w)=>{
 if(n){const num=n.toLowerCase().startsWith('x')?parseInt(n.slice(1),16):Number(n);return num>0&&num<=0x10ffff?String.fromCodePoint(num):'';}
 return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[w.toLowerCase()];
});}
function val(xml,tag){const escaped=tag.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return entities((xml.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`,'i'))||[])[1]||'').trim();}
function xmlField(xml,names){for(const n of names){const v=val(xml,n);if(v)return clean(v);}return '';}
function urlField(xml){const direct=xmlField(xml,['link','url','event:url']);if(direct.startsWith('https://'))return direct;const atom=xml.match(/<link\b[^>]*\bhref\s*=\s*['"]([^'"]+)['"]/i);return atom?.[1]?.startsWith('https://')?entities(atom[1]):'';}
function isoDate(s){if(typeof s!=='string'||!s)return null;const value=s.trim();const dt=new Date(value);if(!Number.isFinite(dt.valueOf()))return null;return dt.toISOString();}
export function icsDate(v){
 const s=String(v||'').trim();
 if(/^\d{8}$/.test(s))return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T00:00:00+05:00`;
 const m=s.match(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)?(Z)?$/);
 if(!m)return null;
 const date=`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]||'00'}`+(m[7]?'Z':'+05:00');
 return isoDate(date);
}
function unescapeIcs(s){return s.replace(/\\n/gi,'\n').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\').trim();}
function normalizeCity(v,hint){const t=String(v||'').toLowerCase();const matches=CITIES.filter(x=>new RegExp(`\\b${x.toLowerCase()}\\b`).test(t));return matches.length===1?matches[0]:(matches.length===0?hint||null:null);}
function coords(raw){
 let lat=Number(raw.lat??raw.latitude),lng=Number(raw.lng??raw.longitude??raw.lon);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat===0||lng===0)return {lat:null,lng:null};
 return {lat,lng};
}
function getLocation(e){return typeof e.location==='object'&&e.location!==null?e.location:{};}
export function parseJsonFeed(text){
 const payload=JSON.parse(text);const list=Array.isArray(payload)?payload:(Array.isArray(payload?.events)?payload.events:(Array.isArray(payload?.data)?payload.data:(Array.isArray(payload?.results)?payload.results:[])));
 if(!Array.isArray(list))return [];
 return list.slice(0,300).map(e=>{
 if(!e||typeof e!=='object')return null;
 // TheSportsDB eventsnextleague / eventsnext: fields are distinct from generic event JSON.
 if(e.idEvent||e.strEvent){
  const day=String(e.dateEvent||'');const time=String(e.strTime||'');
  const start=e.strTimestamp||(day&&/^\d{4}-\d{2}-\d{2}$/.test(day)?(time?day+'T'+time.replace(/Z$/,'')+'Z':day):null);
  return {externalId:String(e.idEvent||''),name:clean(e.strEvent),start,description:clean(e.strDescriptionEN||''),venue:clean(e.strVenue||''),city:clean(e.strCity||''),country:clean(e.strCountry||''),lat:e.strLatitude??null,lng:e.strLongitude??null,link:'',ticket:'unknown',price:'',organizer:clean(e.strLeague||'')};
 }
 const location=getLocation(e),c=coords({...e,...location});
 return {externalId:String(e.id??e.uid??e.url??e.source_url??''),name:clean(e.title??e.name),start:e.startDate??e.start_at??e.start??e.date,description:clean(e.description??''),venue:clean(e.venue??location.name??e.locationName),city:String(e.city??location.city??''),country:String(e.country??location.country??''),...c,link:String(e.url??e.link??e.source_url??''),ticket:String(e.ticketType??e.ticket_type??'unknown'),price:clean(e.price??e.priceText??''),organizer:clean(e.organizer??'')};
 }).filter(Boolean);
}
export function parseRssFeed(xml){
 const items=[...xml.matchAll(/<(?:item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/(?:item|entry)>/gi)].slice(0,300);
 return items.map(([,body])=>({
  externalId:xmlField(body,['guid','id'])||urlField(body),name:xmlField(body,['title']),
  // RSS pubDate is an ARTICLE publishing date and is intentionally not accepted.
  start:xmlField(body,['event:startDate','event:start','ev:startdate','dtstart','startDate','start_date']),
  description:xmlField(body,['description','summary','content:encoded']).slice(0,500),
  venue:xmlField(body,['event:venue','event:location','venue','location']),city:xmlField(body,['event:city','city']),
  lat:xmlField(body,['geo:lat','event:latitude','latitude']),lng:xmlField(body,['geo:long','geo:lon','event:longitude','longitude']),
  link:urlField(body),ticket:xmlField(body,['event:ticketType','ticketType'])||'unknown',price:xmlField(body,['event:price','price']),organizer:xmlField(body,['event:organizer','organizer'])
 }));
}
export function parseIcsFeed(text){
 const unfolded=text.replace(/\r\n[ \t]|\n[ \t]/g,'').replace(/\r/g,'');
 return [...unfolded.matchAll(/BEGIN:VEVENT\n([\s\S]*?)END:VEVENT/g)].slice(0,300).map(([,b])=>{
  const props={};let tz='';for(const row of b.split('\n')){const colon=row.indexOf(':');if(colon<0)continue;const head=row.slice(0,colon);const k=head.split(';')[0].toUpperCase();if(k==='DTSTART')tz=(head.match(/TZID=([^;:]+)/i)||[])[1]||'';props[k]=unescapeIcs(row.slice(colon+1));}
  const geo=String(props.GEO||'').split(';');return {externalId:props.UID||'',name:clean(props.SUMMARY),allDay:/^\d{8}$/.test(props.DTSTART||''),start:(tz&&!['Asia/Karachi','UTC'].includes(tz))||props.RRULE?null:icsDate(props.DTSTART),description:clean(props.DESCRIPTION).slice(0,500),venue:clean(props.LOCATION),city:clean(props['X-PCI-CITY']),lat:geo.length===2?geo[0]:null,lng:geo.length===2?geo[1]:null,link:props.URL||'',ticket:'unknown',price:'',organizer:clean(props.ORGANIZER)};
 });
}
export function normalizeEvent(raw,source,now=Date.now()){
 const name=clean(raw.name).slice(0,180),venue=clean(raw.venue).slice(0,200),description=clean(raw.description).slice(0,1000);
 if(raw.country&& !/^(pakistan|pk)$/i.test(String(raw.country).trim()))return {ok:false,reason:'Event country is not Pakistan'};
 const start=isoDate(/^\d{4}-\d{2}-\d{2}$/.test(String(raw.start||''))?String(raw.start)+'T00:00:00+05:00':String(raw.start??''));const city=normalizeCity(`${raw.city||''} ${venue}`,source.city_hint);
 if(!name||!start||Date.parse(start)<=now||!venue||!city)return {ok:false,reason:'Missing future date, title, venue, or recognized city'};
 if(!CATEGORIES.includes(source.category))return {ok:false,reason:'Unsupported category'};
 const c=coords(raw); // Missing coordinates remain pending and must be verified before map publication.
 const link=String(raw.link||'').trim();let safeLink=null;try{if(link)safeLink=validateHttpsUrl(link);}catch{}
 const ticket=['free','paid'].includes(String(raw.ticket).toLowerCase())?String(raw.ticket).toLowerCase():'unknown';
 const id=clean(raw.externalId)||`${name}|${start}|${venue}`;
 const item={all_day:Boolean(raw.allDay)||/^\d{4}-\d{2}-\d{2}$/.test(String(raw.start||'')),external_id:createHash('sha256').update(id).digest('hex'),name,start_at:start,city,category:source.category,venue,latitude:c.lat,longitude:c.lng,description,event_url:safeLink,organizer:clean(raw.organizer).slice(0,160),ticket_type:ticket,price_text:ticket==='paid'?clean(raw.price).slice(0,100):''};
 const fingerprint=createHash('sha256').update(JSON.stringify(item)).digest('hex');
 return {ok:true,item:{...item,fingerprint}};
}
