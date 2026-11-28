/** Read-only deployed-service checks. No credentials, API collection or writes. */
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
export async function smoke(base,{expectedTikTok,website,fetcher=fetch}={}){
 const root=new URL(base);if(root.protocol!=='https:'||root.username||root.password)throw Error('Use the HTTPS backend origin without credentials.');
 const checks=[];
 async function check(label,path,valid){
  try{const r=await fetcher(new URL(path,root),{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});const data=await r.json();checks.push({label,status:r.ok&&valid(data)?'pass':'failed',http:r.status});}
  catch{checks.push({label,status:'failed',http:null});}
 }
 await check('Backend liveness','/health/live',r=>r.status==='alive');
 await check('Backend readiness','/health/ready',r=>r.status==='ready');
 await check('Existing wheel','/api/v1/public/wheel',r=>Array.isArray(r.data?.sorts)&&r.data.sorts.length===3&&r.data.sorts.every(x=>x.publishedAt&&Array.isArray(x.entries)&&x.entries.length>0));
 await check('Existing YouTube and Instagram rows','/api/v1/public/rows',r=>['youtube.subscribed','instagram.followers'].every(s=>r.data?.platforms?.some(x=>x.scope===s&&x.publishedAt&&x.entries?.length)));
 await check('Central followers publication status','/api/v1/public/status',r=>r.data?.scopes?.some(s=>s.scope==='tiktok.followers'&&s.publishedAt&&(expectedTikTok===undefined||s.covered===expectedTikTok)));
 await check('Public TikTok followers','/api/v1/public/tiktok?metric=followers&limit=100',r=>Array.isArray(r.data)&&r.data.every(x=>Number.isInteger(x.rank)&&x.rank>0&&Number.isSafeInteger(x.followers)&&x.followers>=0&&!x.stale)&&(expectedTikTok===undefined?r.data.length>0:r.pagination?.total===expectedTikTok&&r.data.length===Math.min(100,expectedTikTok)));
 if(website){try{const u=new URL(website);if(u.protocol!=='https:'||u.username||u.password)throw Error('Invalid website');const r=await fetcher(new URL('/admin',u),{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(20000)});checks.push({label:'Public admin route absent',status:r.status===404?'pass':'failed',http:r.status});}catch{checks.push({label:'Public admin route absent',status:'failed',http:null});}}
 return {checks,passed:checks.every(x=>x.status==='pass'),note:'HTTP smoke only; this does not prove full provider, worker or historical migration certification.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const {values}=parseArgs({options:{api:{type:'string'},website:{type:'string'},expected:{type:'string'}},strict:true});const expected=values.expected===undefined?undefined:Number(values.expected);if(expected!==undefined&&(!Number.isSafeInteger(expected)||expected<0))throw Error('Expected count must be a nonnegative integer');const r=await smoke(values.api,{website:values.website,expectedTikTok:expected});console.log(JSON.stringify(r,null,2));if(!r.passed)process.exitCode=1;}
 catch{console.error('PCI_RELEASE_SMOKE: invalid arguments or unavailable service.');process.exitCode=1;}
}
