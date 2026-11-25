import { resolve4 } from 'node:dns/promises';
import { request } from 'node:https';
import { metaProperty } from '../ingest/http.js';
import { sniffImage } from '../ingest/avatar-cache-rules.js';
import { MAX_IMAGE_BYTES, publicIPv4, safeSource, commonsQuery, allowedCommonsLicense } from './image-rules.mjs';

// DNS is resolved once and the validated IPv4 address is pinned for the actual TLS connection.
// No redirects, cookies, credentials, proxies, or anti-bot bypasses.
export async function boundedHttps(raw:string,max:number,accept:string):Promise<{body:Buffer;type:string}> {
 const u=safeSource(raw);if(!u)throw new Error('UNSAFE_URL');
 let timer:ReturnType<typeof setTimeout>|undefined;
 let addresses:string[];
 try{addresses=await Promise.race([resolve4(u.hostname),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('DNS_TIMEOUT')),4000);})]);}
 finally{if(timer)clearTimeout(timer);}
 if(!addresses.length||addresses.some(ip=>!publicIPv4(ip)))throw new Error('UNSAFE_ADDRESS');
 return new Promise((resolve,reject)=>{
  const req=request({hostname:addresses[0],port:443,servername:u.hostname,method:'GET',path:u.pathname+u.search,agent:false,
   headers:{Host:u.hostname,Accept:accept,'Accept-Encoding':'identity','User-Agent':'PCI-RestaurantImages/1.0 (authorized public image retrieval)'}},res=>{
    if(res.statusCode!==200||Number(res.headers['content-length']??0)>max||res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'){res.destroy();reject(new Error('HTTP_REJECTED'));return;}
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
  const value=metaProperty(page.body.toString('utf8'),'og:image');
  if(!value)throw new Error('NO_OG_IMAGE');
  imageUrl=new URL(value,source).href;
 }
 const photo=await boundedHttps(imageUrl,MAX_IMAGE_BYTES,'image/jpeg,image/png,image/webp');
 const kind=sniffImage(photo.body);
 if(!kind||photo.type!==kind.contentType||photo.body.length===0)throw new Error('INVALID_IMAGE');
 return {imageUrl,bytes:photo.body,contentType:kind.contentType};
}
// Discovery only: a matching search result is NOT proof of restaurant identity or permission.
// A human must review the original Commons file and confirm the precise branch before publishing.
export async function discoverCommons(name:string,city:string,area?:string|null){
 const u=new URL('https://commons.wikimedia.org/w/api.php');
 u.search=new URLSearchParams({action:'query',format:'json',generator:'search',gsrnamespace:'6',gsrlimit:'6',gsrsearch:commonsQuery(name,city,area),prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'320',iiextmetadatafilter:'LicenseShortName|LicenseUrl|Artist'}).toString();
 const r=await boundedHttps(u.href,300000,'application/json');
 if(r.type!=='application/json')throw new Error('INVALID_COMMONS_RESPONSE');
 const data=JSON.parse(r.body.toString('utf8')) as {query?:{pages?:Record<string,{title?:string;imageinfo?:Array<{thumburl?:string;descriptionurl?:string;extmetadata?:Record<string,{value?:string}>}>}>}};
 const plain=(s:string)=>s.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
 return Object.values(data.query?.pages??{}).flatMap(p=>{
  const i=p.imageinfo?.[0],m=i?.extmetadata,licence=m?.LicenseShortName?.value??'',attribution=plain(m?.Artist?.value??'');
  if(!i?.thumburl||!i.descriptionurl||!attribution||!allowedCommonsLicense(licence)||safeSource(i.thumburl)?.hostname!=='upload.wikimedia.org'||safeSource(i.descriptionurl)?.hostname!=='commons.wikimedia.org')return [];
  return [{title:p.title??'Commons file',sourceUrl:i.thumburl,permissionUrl:i.descriptionurl,attribution:attribution.slice(0,500),licence,licenceUrl:m?.LicenseUrl?.value??null}];
 });
}
