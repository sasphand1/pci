import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root=resolve('.');
const read=(p)=>readFileSync(join(root,p),'utf8');
const ts=createRequire(import.meta.url)('typescript');
const dir=mkdtempSync(join(tmpdir(),'pci-glass-'));
let n=0;
// Compiles one pure .ts file of the app and imports it, so the real code is tested, not a copy.
async function load(file){
 const out=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const target=join(dir,`m${n++}.mjs`);writeFileSync(target,out);return import(pathToFileURL(target).href);
}

test('idle rules: active, warning in the last minute, expiry, and the absolute limit',async()=>{
 const {idleState,clock,WARN_SECONDS}=await load('src/lib/session.ts');
 const S=1000,idle=1800;const t0=1_000_000;
 assert.deepEqual(idleState(t0,t0,idle,null),{kind:'active'});
 assert.deepEqual(idleState(t0+(idle-WARN_SECONDS-1)*S,t0,idle,null),{kind:'active'});
 assert.deepEqual(idleState(t0+(idle-60)*S,t0,idle,null),{kind:'idle-warning',secondsLeft:60});
 assert.deepEqual(idleState(t0+(idle-1)*S,t0,idle,null),{kind:'idle-warning',secondsLeft:1});
 assert.deepEqual(idleState(t0+idle*S,t0,idle,null),{kind:'idle-expired'});
 // absolute limit
 assert.deepEqual(idleState(t0,t0,idle,t0+30*S),{kind:'limit-warning',secondsLeft:30});
 assert.deepEqual(idleState(t0,t0,idle,t0),{kind:'limit-expired'});
 assert.deepEqual(idleState(t0,t0,idle,t0+8*3600*S),{kind:'active'});
 // the nearer end decides the warning
 const now=t0+(idle-20)*S;
 assert.equal(idleState(now,t0,idle,now+8*3600*S).kind,'idle-warning');          // idle end is nearer
 const now2=t0+(idle-50)*S;
 assert.deepEqual(idleState(now2,t0,idle,now2+20*S),{kind:'limit-warning',secondsLeft:20}); // absolute end is nearer
 assert.equal(clock(65),'1:05');assert.equal(clock(9),'0:09');assert.equal(clock(-3),'0:00');
});

test('chart geometry: gaps stay gaps, single point is centred, the scale never exceeds a clean maximum',async()=>{
 const c=await load('src/lib/chart.ts');
 const b={width:600,height:200,left:0,right:0,top:0,bottom:0};
 assert.equal(c.niceMax([[null,null]]),1);assert.equal(c.niceMax([[7,9],[null,12]]),15);assert.equal(c.niceMax([[83_100_000]]),100_000_000);
 assert.equal(c.linePath([10,null,10],10,b),'M0,0M600,0');
 assert.equal(c.linePath([0,10],10,b),'M0,200L600,0');
 assert.equal(c.linePath([],10,b),'');
 assert.deepEqual(c.lastPoint([5,null],10,b),{x:0,y:100,value:5});assert.equal(c.lastPoint([null],10,b),null);
 assert.equal(c.xAt(0,1,b),300);assert.equal(c.yAt(-5,10,b),200);assert.equal(c.yAt(99,10,b),0);
});

test('number formatting',async()=>{
 const f=await load('src/lib/format.ts');
 assert.equal(f.compact(0),'0');assert.equal(f.compact(999),'999');assert.equal(f.compact(12400),'12.4K');assert.equal(f.compact(8_900_000),'8.9M');assert.equal(f.compact(-1),'0');assert.equal(f.compact(NaN),'0');
 assert.equal(f.initials('Nadir Ali'),'NA');assert.equal(f.initials("Rajab's Family Vlogs"),'RF');assert.equal(f.initials('  '),'?');
 assert.equal(f.signedPct(1.8),'+1.8%');assert.equal(f.signedPct(-3),'-3%');assert.equal(f.signedPct(0),'0%');assert.equal(f.signedPct(null),null);
});

test('navigation is grouped, role-filtered, has no empty group, and no dead entries',async()=>{
 const nav=await load('src/lib/nav.ts');
 const titles=(r)=>nav.visibleGroups(r).flatMap(g=>g.items.map(i=>i.title));
 assert.deepEqual(titles('moderator'),['Overview','Progress','Live wall','My security','Settings']);
 assert.ok(titles('editor').includes('People')&&titles('editor').includes('Pipeline')&&!titles('editor').includes('Audit log')&&!titles('editor').includes('Team'));
 assert.equal(titles('owner').length,nav.NAV.length);
 for(const r of ['owner','editor','moderator'])for(const g of nav.visibleGroups(r))assert.ok(g.items.length>0);
 assert.deepEqual(nav.NAV_GROUPS.map(g=>g.label),[null,'Rankings','Website','Satify','Administration']);
 const hrefs=nav.NAV.map(i=>i.href);assert.equal(new Set(hrefs).size,hrefs.length);
 assert.ok(!hrefs.includes('/videos'));
 for(const h of hrefs)assert.ok(existsSync(join(root,'src/app',h==='/'?'':h,'page.tsx')),`no page for ${h}`);
});

test('session handling: server 401 returns to sign-in, tabs stay in step, polling is not activity',()=>{
 const api=read('src/lib/api.ts'),auth=read('src/components/AuthProvider.tsx'),guard=read('src/components/SessionGuard.tsx'),shared=read('src/components/Shared.tsx');
 assert.match(api,/SESSION_EXPIRED_EVENT/);assert.match(api,/response\.status===401&&path!=='\/admin\/auth\/login'&&path!=='\/admin\/auth\/me'/);
 assert.match(api,/X-Pci-Background/);
 assert.match(auth,/addEventListener\(SESSION_EXPIRED_EVENT/);assert.match(auth,/BroadcastChannel/);assert.match(auth,/'logout'/);assert.match(auth,/'login'/);assert.match(auth,/Your session ended/);
 assert.match(guard,/idleState\(/);assert.match(guard,/role="alertdialog"/);assert.match(guard,/aria-modal="true"/);assert.match(guard,/visibilitychange/);assert.match(guard,/Stay signed in/);
 assert.match(shared,/background\?:unknown[\s\S]*background===true/);assert.match(read('src/app/pipeline/page.tsx'),/status\.reload\(true\)/);
 assert.match(read('src/components/OverviewProvider.tsx'),/api<Overview>\('\/admin\/overview',\{background\}\)/);
 assert.match(read('src/components/AdminShell.tsx'),/<SessionGuard\/>/);assert.match(read('src/components/AdminShell.tsx'),/<OverviewProvider>/);
});

test('sign-in clears the password and code after a failure, and shows why a session ended',()=>{
 const s=read('src/components/AdminShell.tsx');assert.match(s,/setPassword\(''\);setTotp\(''\)/);assert.match(s,/\{notice&&<Notice tone="warning">/);
});

test('error messages are human and say where a server problem comes from',async()=>{
 const {errorText,ApiError}=await load('src/lib/api.ts');
 assert.match(errorText(new ApiError(429,'RATE_LIMIT','x')),/Too many attempts/);
 assert.match(errorText(new ApiError(403,'FORBIDDEN','x')),/Your role cannot do this/);
 assert.match(errorText(new ApiError(400,'CSRF','x')),/Reload the page/);
 // Hosting gateway page (not Module 1's JSON): says Module 1 is not answering and gives the status
 const gw=errorText(new ApiError(503,'BAD_RESPONSE','x'));assert.match(gw,/Module 1 is not answering \(HTTP 503\)/);assert.match(gw,/runtime log/);
 // Module 1's own failure: code and a short reference to search for in its log
 const own=errorText(new ApiError(500,'INTERNAL_ERROR','x','abcdef12-0000-0000'));assert.match(own,/INTERNAL_ERROR/);assert.match(own,/Reference abcdef12\./);assert.match(own,/PCI_API_FAILURE/);
 assert.ok(!own.includes('0000-0000'),'only a short reference is shown');
});

test('bulk add: a chosen category fills only lines without one; comments and blanks stay; select-all on a page',async()=>{
 const {applyDefaultNiche,togglePage}=await load('src/lib/bulk.ts');
 const out=applyDefaultNiche('@a\n@b, Bee\n@c, Cee, tech\n# note\n\n@d, Dee, ','gamer').split('\n');
 assert.deepEqual(out,['@a, , gamer','@b, Bee, gamer','@c, Cee, tech','# note','','@d, Dee, gamer']);
 assert.equal(applyDefaultNiche('@a',''),'@a');
 assert.deepEqual(togglePage(['x','1'],['1','2'],true),['x','1','2']);assert.deepEqual(togglePage(['x','1','2'],['1','2'],false),['x']);
 const page=read('src/app/bucket/page.tsx');
 assert.match(page,/applyDefaultNiche\(bulk,bulkNiche\)/);assert.match(page,/Category for every line without one/);
 assert.match(page,/window\.confirm\(`Set \$\{cat\.label\}/);assert.match(page,/canEdit=identity\?\.role==='owner'\|\|identity\?\.role==='editor'/);
});

test('compact Microsoft-style scale and a visible menu: rules beat the public-site stylesheet',()=>{
 const css=read('src/app/glass.css');
 // @pci/ui sets .admin-nav a{color:#d4e0e8} for a dark sidebar; our glass sidebar is pale, so the menu rule must be at least as specific.
 assert.match(css,/\.admin-nav a\.nav-link\{[^}]*color:var\(--ink\)/);
 assert.match(css,/body\{font-size:14px/);
 assert.match(css,/\.admin-app \.btn,\.admin-login-shell \.btn\{min-height:32px/);
 assert.match(css,/\.admin-app h1,\.admin-login-shell h1\{font-size:1\.45rem/);
 assert.ok(!/fonts\.googleapis|@import url/.test(css),'no external fonts (CSP)');
});

test('Overview page reads the live endpoint, confirms before running the pipeline, and hides actions from moderators',()=>{
 const s=read('src/app/page.tsx');
 assert.match(s,/useOverview\(\)/);assert.match(s,/'\/admin\/pipeline\/run',\{method:'POST',csrf:identity\?\.csrfToken\}/);assert.match(s,/window\.confirm\(/);
 assert.match(s,/canWork=identity\?\.role==='owner'\|\|identity\?\.role==='editor'/);assert.match(s,/\{canWork&&<button/);
 assert.match(s,/Needs attention/);assert.match(s,/Top of the wheel/);assert.match(s,/Nothing yet/);
 assert.doesNotMatch(s,/Math\.random|lorem|placeholder/i);
});

test('glass theme: one stylesheet, three-colour core, blur with fallbacks, reduced motion and transparency respected',()=>{
 assert.match(read('src/app/layout.tsx'),/import '\.\/glass\.css'/);
 const css=read('src/app/glass.css');
 assert.match(css,/backdrop-filter:blur\(24px\)/);assert.match(css,/@supports not/);assert.match(css,/prefers-reduced-transparency/);
 assert.match(css,/--glass-indigo:#4F4FE0/i);assert.match(css,/--glass-aqua:#19C3B1/i);
});

function lum(hex){const h=hex.replace('#','');const c=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];}
const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05);};
test('text stays readable: white on both button colours, ink and muted ink on frosted white, status chip text on its tint',()=>{
 const css=read('src/app/glass.css');const token=(n)=>{const m=css.match(new RegExp(`--${n}:(#[0-9A-Fa-f]{6})`));assert.ok(m,n);return m[1];};
 assert.ok(ratio('#FFFFFF',token('glass-indigo'))>=4.5,'white on indigo (read from the stylesheet)');
 assert.ok(ratio('#FFFFFF',token('glass-aqua-deep'))>=4.5,'white on deep aqua (read from the stylesheet)');
 assert.ok(ratio('#FFFFFF',token('glass-indigo-deep'))>=4.5,'white on deep indigo');
 assert.ok(ratio('#1B1F3B','#F4F6FF')>=7,'ink on frost');
 assert.ok(ratio('#565C85','#F4F6FF')>=4.5,'muted ink on frost');
 assert.ok(ratio('#0B6F64','#D9F3EF')>=4.5,'ok chip');
 assert.ok(ratio('#7A4B00','#FBEACB')>=4.5,'attention chip');
 assert.ok(ratio('#8D2729','#F7DDDD')>=4.5,'down chip');
 assert.ok(ratio('#3A33B5','#DEDDF7')>=4.5,'idle chip');
});

test('Module 1 provides what the new screens call',()=>{
 const routes=join(root,'../Module_1_Adapter/src/modules/publish/routes.ts');if(!existsSync(routes))return;
 const s=readFileSync(routes,'utf8');assert.ok(s.includes("'/overview'"));
 const auth=readFileSync(join(root,'../Module_1_Adapter/src/modules/auth/auth.ts'),'utf8');assert.match(auth,/x-pci-background/);assert.match(auth,/sessionInfo\(/);
});

test('deploy overlap: a quiet request refused by an older API retries once without the header; normal requests and real errors do not',async()=>{
 const {api,isApiUpdating,ApiError}=await load('src/lib/api.ts');
 const seen=[];const real=globalThis.fetch;
 const ok=()=>new Response(JSON.stringify({data:{fine:true}}),{status:200});
 try{
  // Old API: the browser blocks the request because of the extra header (a network failure), but allows it without.
  globalThis.fetch=async(_u,i)=>{seen.push(Boolean(i.headers['X-Pci-Background']));if(i.headers['X-Pci-Background'])throw new TypeError('Failed to fetch');return ok();};
  assert.deepEqual(await api('/x',{background:true}),{fine:true});assert.deepEqual(seen,[true,false]);
  // A normal (non-quiet) request is never retried: a real outage must show.
  seen.length=0;globalThis.fetch=async(_u,i)=>{seen.push(false);throw new TypeError('Failed to fetch');};
  await assert.rejects(api('/x'),e=>e instanceof ApiError&&e.code==='NETWORK');assert.equal(seen.length,1);
  // A quiet request that fails on the server (not the network) is not retried.
  seen.length=0;globalThis.fetch=async()=>{seen.push(true);return new Response(JSON.stringify({error:{code:'X',message:'bad'}}),{status:500});};
  await assert.rejects(api('/x',{background:true}),e=>e.status===500);assert.equal(seen.length,1);
 }finally{globalThis.fetch=real;}
 assert.equal(isApiUpdating(new ApiError(404,'NOT_FOUND','x')),true);assert.equal(isApiUpdating(new ApiError(500,'X','x')),false);assert.equal(isApiUpdating(new Error('x')),false);
});

test('update flow: steps follow the run, the headline is honest, and rejections read as plain reasons',async()=>{
 const {flowSteps,flowHeadline,rejectedReasons,plainSystemReason}=await load('src/lib/flow.ts');
 const st=a=>a.map(x=>x.state).join(',');
 assert.equal(st(flowSteps(undefined,false,false)),'waiting,waiting,waiting');
 assert.equal(st(flowSteps({status:'running',steps:[]},true,false)),'active,waiting,waiting');
 assert.equal(st(flowSteps({status:'running',steps:[{step:'refresh',status:'ok'}]},true,false)),'done,active,waiting');
 assert.equal(st(flowSteps({status:'partial',steps:[{step:'refresh',status:'ok'},{step:'rank',status:'ok'},{step:'publish',status:'partial',detail:'0 published'}]},false,false)),'done,done,problem');
 assert.equal(st(flowSteps({status:'failed',steps:[{step:'refresh',status:'ok'},{step:'rank',status:'failed'},{step:'publish',status:'skipped'}]},false,false)),'done,problem,skipped');
 assert.equal(st(flowSteps(undefined,false,true)),'active,waiting,waiting'); // a refresh started by hand shows as collecting
 assert.equal(flowHeadline({running:true,total:0,rejected:0,liveCount:0}).tone,'busy');
 assert.equal(flowHeadline({running:false,total:0,rejected:0,liveCount:0}).tone,'idle');
 assert.equal(flowHeadline({running:false,lastStatus:'succeeded',total:11,rejected:0,liveCount:11}).tone,'ok');
 const bad=flowHeadline({running:false,lastStatus:'partial',total:11,rejected:11,liveCount:0});
 assert.equal(bad.tone,'attention');assert.match(bad.title,/11 of 11 rankings were kept out/);
 assert.equal(flowHeadline({running:false,lastStatus:'failed',total:0,rejected:0,liveCount:3}).tone,'attention');
 // eleven rankings that failed one check read as one reason
 const drafts=[...Array(11)].map((_,i)=>({scope:`s${i}`,status:'rejected',gateFailures:[{gate:'coverage',message:'Only 0 of 6 people have fresh data (needs at least 50%)'}]})).concat([{scope:'ok',status:'draft',gateFailures:[]}]);
 const r=rejectedReasons(drafts);assert.equal(r.length,1);assert.equal(r[0].scopes.length,11);assert.match(r[0].why,/last 7 days/);assert.match(r[0].fix,/Update rankings now/);
 assert.equal(rejectedReasons([{scope:'x',status:'rejected',gateFailures:[{gate:'something_new',message:'m'}]}])[0].fix.includes('System health'),true);
 assert.match(plainSystemReason('The background worker has not been seen'),/RUN_WORKER_IN_API=true/);
 assert.equal(plainSystemReason('2 open alerts'),'2 open alerts');
});

test('pipeline page: one primary button, details hidden by default, no rank while running',()=>{
 const page=read('src/app/pipeline/page.tsx');
 assert.match(page,/Update rankings now/);assert.match(page,/useState\(false\),\[showAllAlerts/);
 assert.match(page,/\{showDetails&&<>/);assert.match(page,/disabled=\{!!busy\|\|running\} onClick=\{rank\}/);
 assert.match(page,/admin\/pipeline\/alerts\/ack-all/);assert.match(page,/window\.confirm\('Update rankings now\?/);
});
