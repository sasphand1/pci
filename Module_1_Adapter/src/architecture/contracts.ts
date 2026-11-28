/** Batch 1: observational contracts. No authorization or database permissions are granted here. */
export type SourcePolicy = { domain: string; platform?: string; destination: 'main_hub'; kinds?: readonly string[]; candidate?: boolean };
const creator = (platform: string): SourcePolicy => ({domain:'creators',platform,destination:'main_hub',kinds:['account','content','comment']});
const satellite: SourcePolicy = {domain:'satellite',destination:'main_hub'};
export const SOURCE_POLICIES: Readonly<Record<string,SourcePolicy>> = Object.freeze({
  'youtube.api':creator('youtube'),'youtube.http':creator('youtube'),
  'instagram.api':creator('instagram'),'instagram.http':creator('instagram'),
  'tiktok.http':creator('tiktok'),
  'scrappa.api':{...creator('tiktok'),candidate:true},
  'google_places.api':{domain:'places',destination:'main_hub',kinds:['place']},
  'restaurant_images.http':{domain:'places',destination:'main_hub'},
  'sat_firms.api':satellite,'sat_power.api':satellite,'sat_eonet.api':satellite,
  'sat_usgs.api':satellite,'sat_gibs.api':satellite,'sat_gpm.api':satellite,
  'sat_airquality.api':satellite,'sat_weather.api':satellite,'sat_flood.api':satellite,
  'sat_gdacs.api':satellite,'sat_swpc.api':satellite,'sat_celestrak.api':satellite,
  'sat_openaq.api':satellite,'sat_insights.api':satellite,
  'satify.api':{domain:'satify',destination:'main_hub',kinds:['satify_scope']},
});
export const ERRORS = Object.freeze({
  PCI_ARCH_001:'Declare the source in the architecture contract; route provider observations through the Main Data Hub.',
  PCI_ARCH_002:'Use a declared entity kind for this source and its authorized bucket.',
  PCI_ARCH_003:'Resolve the registry account and use the platform-prefixed entity key. Unlinked candidates are staging only.',
  PCI_ARCH_004:'Public reads must use the approved bucket projection or published ranking pointers, not provider staging.',
  PCI_ARCH_005:'Build rankings through the central engine, gates and publication service.',
  PCI_ARCH_006:'Review this direct Hub write; use the canonical ingestion interface or an explicitly approved bulk/migration bridge.',
  PCI_ARCH_007:'Move runtime DDL to controlled migrations before restricting runtime credentials.',
  PCI_ARCH_008:'Declare the metric in the source-specific contract; do not silently introduce a new field.',
  PCI_ARCH_009:'Review unresolved dynamic SQL or routing manually before granting database permissions.',
  PCI_ARCH_010:'Preserve the existing compatibility bridge until its replacement is proven and approved.',
  PCI_ARCH_011:'Route Scrappa candidates through the Creators Bucket staging writer with a matching numeric candidate ID, candidate metadata and a null account association. Registered promotion requires the approved registry-to-Hub pipeline, not this staging writer.',
});
export type Code = keyof typeof ERRORS;
export type Finding = {code:Code; correction:string};
export function finding(code:Code):Finding {return {code,correction:ERRORS[code]};}
// Scrappa metrics verified against the current main tiktok-staging writer. Other metric
// lists remain discovery-only until production SQL and bulk bridges have been reviewed.
export const SCRAPPA_METRICS: Readonly<Record<string,readonly string[]>> = Object.freeze({
 account:['followers','following','likes','video_count','sample_size','average_views','average_likes','average_comments','average_shares'],
 content:['views','likes','comments','shares','favorites','downloads'],
});
export function inspectObservation(input:{sourceId:string;entityKind:string;entityId:string;accountId:string|null;metric:string;metadata?:Record<string,unknown>}):Finding[] {
 const out:Finding[]=[];
 if(!Object.hasOwn(SOURCE_POLICIES,input.sourceId))return [finding('PCI_ARCH_001')];
 const p=SOURCE_POLICIES[input.sourceId];
 if(p.kinds&&!p.kinds.includes(input.entityKind))out.push(finding('PCI_ARCH_002'));
 if(p.domain==='creators'){
  const staging=p.candidate&&input.accountId===null&&input.entityId.startsWith('tiktok_candidate:')&&input.metadata?.stage==='candidate';
  if(!staging&&(!input.accountId||!input.entityId.startsWith(`${p.platform}:`)))out.push(finding('PCI_ARCH_003'));
  if(p.candidate&&!(SCRAPPA_METRICS[input.entityKind]??[]).includes(input.metric))out.push(finding('PCI_ARCH_008'));
 }
 return out;
}
/** Opt-in shadow only. Do not log raw observation data, identifiers, or credentials.
 * Rate-limit each error code to one warning per minute per process. Never alter ingestion. */
const warnedAt=new Map<Code,number>();
export function observeArchitecture(input:Parameters<typeof inspectObservation>[0]):void {
 if(process.env.PCI_ARCH_SHADOW!=='1')return;
 try {
  for(const f of inspectObservation(input)){
   const now=Date.now();
   if(now-(warnedAt.get(f.code)??-Infinity)<60_000)continue;
   warnedAt.set(f.code,now);
   console.warn(JSON.stringify({event:'pci_architecture_shadow',...f}));
  }
 } catch { /* Observation mode must not affect production collection. */ }
}

/** Batch 2 staged activation: Scrappa's verified candidate writer is the only
 * strict source until the live routing/privilege audit has been reviewed.
 * This is an application boundary, not a database authorization mechanism. */
export class ArchitectureViolation extends Error {
  readonly findings: readonly Finding[];
  constructor(findings: readonly Finding[]) {
    super(findings.map(f=>`${f.code}: ${f.correction}`).join('; '));
    this.name='ArchitectureViolation';
    this.findings=findings;
  }
}
export function enforceArchitecture(input:Parameters<typeof inspectObservation>[0]):void {
  if(input.sourceId!=='scrappa.api')return;
  const findings=inspectObservation(input);
  const id=input.metadata?.candidateId;
  const key=typeof id==='string'&&/^\d{1,30}$/.test(id)?`tiktok_candidate:${id}`:null;
  const staged=key!==null&&input.accountId===null&&input.metadata?.stage==='candidate'&&
    (input.entityKind==='account'?input.entityId===key:
      input.entityKind==='content'&&input.entityId.startsWith(`${key}:`)&&/^\d{1,30}$/.test(input.entityId.slice(key.length+1)));
  if(!staged)findings.push(finding('PCI_ARCH_011'));
  if(findings.length)throw new ArchitectureViolation(findings);
}
