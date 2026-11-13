/** Dependency-free remote API read-only smoke check. */
const base=(process.env.API_BASE_URL??'http://127.0.0.1:8080').replace(/\/$/,'');
const routes=['/health/live','/health/ready','/api/v1/meta','/api/v1/categories','/api/v1/creators?limit=5','/api/v1/overview','/api/v1/status','/api/v1/wall/status'];
let failed=0;
for(const path of routes){
 try{
   const res=await fetch(`${base}${path}`,{signal:AbortSignal.timeout(6000),headers:{accept:'application/json'}});
   const json=await res.json();
   if(!res.ok||!json||typeof json!=='object')throw Error(`HTTP ${res.status}`);
   console.info(`PASS ${res.status} ${path}`);
 }catch(e){failed++;console.error(`FAIL ${path}: ${e instanceof Error?e.message:e}`);}
}
console.info(`${routes.length-failed}/${routes.length} smoke endpoints passed`);
process.exitCode=failed?1:0;
