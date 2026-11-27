export type RegistrationRow={account:string;person?:string;niche?:string};
/** Same strict accepted profile forms as the adapter. Keep first row for a duplicate handle. */
export function normalizedTikTokAccount(raw:string):string|null{
 let v=raw.trim();
 try{if(v.includes('/')){const u=new URL(v.startsWith('https://')?v:'https://'+v);if(u.protocol!=='https:'||!['tiktok.com','www.tiktok.com','m.tiktok.com'].includes(u.hostname)||u.username||u.password||u.port||!/^\/@[^/]+\/?$/.test(u.pathname))return null;v=u.pathname.split('/')[1];}}
 catch{return null;}
 v=v.replace(/^@/,'').toLowerCase();return /^[a-z0-9._]{2,24}$/.test(v)?v:null;
}
export function prepareRegistration(rows:RegistrationRow[]){
 const valid:RegistrationRow[]=[],invalid:string[]=[],duplicates:string[]=[];const seen=new Set<string>();
 for(const row of rows){const handle=normalizedTikTokAccount(row.account);if(!handle){invalid.push(row.account||'(empty account)');continue;}
  if(seen.has(handle)){duplicates.push(handle);continue;}seen.add(handle);valid.push({...row,account:handle});}
 return {valid,invalid,duplicates};
}
