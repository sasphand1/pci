import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { sniffImage } from '../ingest/avatar-cache-rules.js';
import { MAX_IMAGE_BYTES, publicIPv4, safeSource, commonsQuery, allowedCommonsLicense, extractWebsiteImages, knownWebsite, osmWebsiteQuery, osmWebsiteCandidates, commonsPhotoTitle, identityWords } from './image-rules.mjs';

// DNS is resolved once and the validated IPv4 address is pinned for the actual TLS connection.
// No redirects, cookies, credentials, proxies, or anti-bot bypasses.
export async function boundedHttps(raw:string,max:number,accept:string):Promise<{body:Buffer;type:string}> {
 const u=safeSource(raw);if(!u)throw new Error('UNSAFE_URL');
 let timer:ReturnType<typeof setTimeout>|undefined;
 let addresses:string[];
 try{addresses=await Promise.race([lookup(u.hostname,{family:4,all:true}).then(rows=>rows.map(x=>x.address)),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('DNS_TIMEOUT')),4000);})]);}
 finally{if(timer)clearTimeout(timer);}
 if(!addresses.length||addresses.some(ip=>!publicIPv4(ip)))throw new Error('UNSAFE_ADDRESS');
 return new Promise((resolve,reject)=>{
  const req=request({hostname:addresses[0],port:443,servername:u.hostname,method:'GET',path:u.pathname+u.search,agent:false,
   headers:{Host:u.hostname,Accept:accept,'Accept-Encoding':'identity','User-Agent':'PCI-RestaurantImages/1.0 (authorized public image retrieval)'}},res=>{
    if(res.statusCode!==200||Number(res.headers['content-length']??0)>max||res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'){res.destroy();reject(new Error(`HTTP_REJECTED_${res.statusCode??0}`));return;}
    let size=0;const chunks:Buffer[]=[];
    res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>max){req.destroy(new Error('TOO_LARGE'));return;}chunks.push(chunk);});
    res.on('error',reject);res.on('aborted',()=>reject(new Error('ABORTED')));
    res.on('end',()=>resolve({body:Buffer.concat(chunks),type:String(res.headers['content-type']??'').split(';')[0].toLowerCase()}));
  });
  const deadline=setTimeout(()=>req.destroy(new Error('HTTP_TIMEOUT')),8000);
  req.on('error',reject);req.on('close',()=>clearTimeout(deadline));req.end();
 });
}
export async function collectAuthorizedImage(source:string,mode:'direct'|'page'){
 let imageUrl=source;
 if(mode==='page'){
  const page=await boundedHttps(source,300000,'text/html');
  if(page.type!=='text/html')throw new Error('NOT_HTML');
  const images=extractWebsiteImages(page.body.toString('utf8'),source,'');
  if(images.length!==1)throw new Error('SELECT_EXACT_IMAGE_URL');
  imageUrl=images[0].url;
 }
 const photo=await boundedHttps(imageUrl,MAX_IMAGE_BYTES,'image/jpeg,image/png,image/webp');
 const kind=sniffImage(photo.body);
 if(!kind||photo.type!==kind.contentType||photo.body.length===0)throw new Error('INVALID_IMAGE');
 return {imageUrl,bytes:photo.body,contentType:kind.contentType};
}
// Discovery only: a matching search result is NOT proof of restaurant identity or permission.
// A human must review the original Commons file and confirm the precise branch before publishing.
export async function discoverCommons(name:string,city:string,area?:string|null,short=false){
 const u=new URL('https://commons.wikimedia.org/w/api.php');
 u.search=new URLSearchParams({action:'query',format:'json',generator:'search',gsrnamespace:'6',gsrlimit:'6',gsrsearch:short?`${identityWords(name).join(' ')} ${city}`:commonsQuery(name,city,area),prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'320',iiextmetadatafilter:'LicenseShortName|LicenseUrl|Artist'}).toString();
 const r=await boundedHttps(u.href,300000,'application/json');
 if(r.type!=='application/json')throw new Error('INVALID_COMMONS_RESPONSE');
 const data=JSON.parse(r.body.toString('utf8')) as {query?:{pages?:Record<string,{title?:string;imageinfo?:Array<{thumburl?:string;descriptionurl?:string;extmetadata?:Record<string,{value?:string}>}>}>}};
 const plain=(s:string)=>s.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
 return Object.values(data.query?.pages??{}).flatMap(p=>{
  const i=p.imageinfo?.[0],m=i?.extmetadata,licence=m?.LicenseShortName?.value??'',attribution=plain(m?.Artist?.value??'');
  if(!commonsPhotoTitle(p.title,name)||!i?.thumburl||!i.descriptionurl||!attribution||!allowedCommonsLicense(licence)||safeSource(i.thumburl)?.hostname!=='upload.wikimedia.org'||safeSource(i.descriptionurl)?.hostname!=='commons.wikimedia.org')return [];
  return [{title:p.title??'Commons file',sourceUrl:i.thumburl,permissionUrl:i.descriptionurl,attribution:attribution.slice(0,500),licence,licenceUrl:m?.LicenseUrl?.value??null}];
 });
}


export type ImageCandidate={title:string;sourceUrl:string;permissionUrl:string;attribution:string;licence:string;licenceUrl:string|null;origin?:string;sourcePage?:string};
export type ImageDiscovery={candidates:ImageCandidate[];diagnostics:string[];status:'found'|'none'|'failed'};
// The result is only a review queue. Website images have no assumed licence or attribution.
export async function discoverRestaurantImages(name:string,city:string,area?:string|null,manualWebsite?:string):Promise<ImageDiscovery>{
 const diagnostics:string[]=[];let successful=0;
 const website=manualWebsite||knownWebsite(name,city);
 const commonsTask=(async()=>{try{let c=await discoverCommons(name,city,area);successful++;if(!c.length&&identityWords(name).length)c=await discoverCommons(name,city,area,true);diagnostics.push(`Commons: ${c.length} photo candidates`);return c.map(x=>({...x,origin:'Wikimedia Commons'}));}catch(e){diagnostics.push(`Commons: ${errorCode(e)}`);return [];}})();
 const siteTask=(async()=>{
  let sites=website?[website]:[];
  if(!sites.length){const q=osmWebsiteQuery(name,city);if(q)try{const u=new URL('https://overpass-api.de/api/interpreter');u.searchParams.set('data',q);const r=await boundedHttps(u.href,100000,'application/json');if(r.type!=='application/json')throw new Error('INVALID_OSM_RESPONSE');const data=JSON.parse(r.body.toString('utf8'));if(!Array.isArray(data.elements)||data.remark)throw new Error('OSM_INCOMPLETE');sites=osmWebsiteCandidates(data,name,area);successful++;diagnostics.push(`OpenStreetMap: ${sites.length} website hints (© OpenStreetMap contributors)`);}catch(e){diagnostics.push(`OpenStreetMap: ${errorCode(e)}`);}}
  // At most one website per discovery, for predictable request volume and timeout.
  if(!sites.length)return [];
  const url=sites[0];try{const r=await boundedHttps(url,500000,'text/html');if(r.type!=='text/html')throw new Error('NOT_HTML');const c=extractWebsiteImages(r.body.toString('utf8'),url,name);successful++;diagnostics.push(`Website: ${c.length} non-logo image candidates`);
   return c.map(x=>({title:x.label||`${name} — ${x.kind} image candidate`,sourceUrl:x.url,permissionUrl:'',attribution:'',licence:'',licenceUrl:null,sourcePage:url,origin:website?'Website supplied or identified; rights unverified':'Website hint from OpenStreetMap; identity and rights unverified'}));
  }catch(e){diagnostics.push(`Website: ${errorCode(e)}`);return [];}
 })();
 const [site,commons]=await Promise.all([siteTask,commonsTask]);const unique=new Map<string,ImageCandidate>();for(const c of [...site,...commons])if(!unique.has(c.sourceUrl))unique.set(c.sourceUrl,c);
 const candidates=[...unique.values()].slice(0,15);
 return {candidates,diagnostics,status:candidates.length?'found':successful?'none':'failed'};
}
function errorCode(e:unknown){const s=e instanceof Error?e.message:'UNAVAILABLE';return /^[A-Z_0-9]+$/.test(s)?s:'NETWORK_OR_DNS_ERROR';}
