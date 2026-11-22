import {request as httpsRequest} from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {validateHttpsUrl} from './parse.js';

export function isPublicIPv4(address:string){
 if(isIP(address)!==4)return false;
 const a=address.split('.').map(Number),[x,y]=a;
 return !(
  x===0||x===10||x===127||x>=224||x===169&&y===254||x===172&&y>=16&&y<=31||
  x===192&&(y===168||y===0||y===88)||x===100&&y>=64&&y<=127||
  x===198&&(y===18||y===19||y===51)||x===203&&y===0||x===192&&y===0||
  x===255
 );
}
/** HTTPS with DNS-validated, pinned public IPv4 per connection; no credentials or custom ports. */
async function readOnce(rawUrl:string):Promise<{text:string;redirect:string|null}>{
 const safe=validateHttpsUrl(rawUrl),url=new URL(safe);
 const records=await lookup(url.hostname,{all:true,family:4,verbatim:true});
 if(!records.length||records.some(r=>!isPublicIPv4(r.address)))throw new Error('Feed hostname has unsafe or unresolvable addresses');
 const selected=records[0].address;
 return await new Promise((resolve,reject)=>{
  let finished=false;
  const req=httpsRequest(url,{
   method:'GET',timeout:8000,headers:{'Accept':'application/rss+xml,application/atom+xml,application/xml,text/calendar,application/json,text/xml;q=0.9','User-Agent':'PCI-Events/1.0 (+operator-managed feeds)'},
   // Pins the validated address used by the socket, preventing a DNS rebind between check and connect.
   lookup:(_host,_opts,cb)=>cb(null,selected,4),
  },res=>{
   const status=res.statusCode||0;
   if(status>=300&&status<400){
    const location=res.headers.location;
    res.resume();
    if(!location){reject(new Error('Feed redirect missing destination'));return;}
    try{resolve({text:'',redirect:new URL(location,url).href});}catch{reject(new Error('Invalid redirect'));}
    return;
   }
   if(status!==200){res.resume();reject(new Error(`Feed returned HTTP ${status}`));return;}
   const chunks:Buffer[]=[];let size=0;
   res.on('data',(chunk:Buffer)=>{
    size+=chunk.length;
    if(size>1_000_000){req.destroy(new Error('Feed exceeds 1 MB limit'));return;}
    chunks.push(chunk);
   });
   res.on('end',()=>{if(!finished){finished=true;resolve({text:Buffer.concat(chunks).toString('utf8'),redirect:null});}});
   res.on('error',reject);
  });
  req.on('error',reject);req.on('timeout',()=>req.destroy(new Error('Feed timeout')));req.end();
 });
}
export async function fetchFeed(url:string){
 let next=validateHttpsUrl(url);
 for(let redirects=0;redirects<=2;redirects++){
  const r=await readOnce(next);
  if(!r.redirect)return r.text;
  next=validateHttpsUrl(r.redirect);
 }
 throw new Error('Too many feed redirects');
}
