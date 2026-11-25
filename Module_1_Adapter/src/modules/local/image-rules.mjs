import { isIP } from 'node:net';
export const MAX_IMAGE_BYTES=200000;
export const MAX_CACHE_BYTES=40000000;
// Deny special-use, non-global, private, multicast and reserved IPv4 ranges.
// IPv6 is deliberately not supported by this collector; there is no fallback.
export function publicIPv4(ip){
 if(isIP(ip)!==4)return false;
 const [a,b,c]=ip.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===88&&c===99)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
}
const forbidden=['google.com','googleapis.com','googleusercontent.com','gstatic.com','goo.gl','google.co.uk','google.com.pk','facebook.com','fbcdn.net','instagram.com','cdninstagram.com','tiktok.com','youtube.com','ytimg.com'];
export function safeSource(raw){
 try{const u=new URL(raw);const h=u.hostname.toLowerCase();
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!h.includes('.')||h.endsWith('.')||isIP(h)||h.includes(':')||h.endsWith('.local')||h.endsWith('.internal')||forbidden.some(d=>h===d||h.endsWith('.'+d))||/(^|\.)google\.[a-z.]+$/.test(h))return null;
 return u;
 }catch{return null;}
}
export function commonsQuery(name,city,area){return [name,area,city,'Pakistan'].filter(Boolean).join(' ').replace(/["\\]/g,' ').slice(0,220);}
export function allowedCommonsLicense(s){return /^(CC BY(?:-SA)? [1-4]\.0|CC0(?: 1\.0)?|Public domain)$/i.test(String(s).trim());}
