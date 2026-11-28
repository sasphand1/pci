import type {AuditDb} from './migration-safety.js';

export type CohortRow = {handle:string;registered:boolean;hub_ready:boolean;observed_at:unknown;ranked_at:unknown;published_rank:unknown;published_value:unknown};
export type ReleaseCheck = {id:string;label:string;status:'pass'|'blocked'|'review';detail:string};
export type ReleaseInput = {mode:string;schemaMode:string;runtimeRole:string;runtimeFindings:string[];migrationIssues:string[];missingTriggers:string[];invalidPointers:number;unmatched:number;cohort:CohortRow[]|null;scheduledDays:{day:string;runs:number}[]};
const DAY=86400000;
const fresh=(v:unknown,now:number)=>{const at=Date.parse(String(v??''));return Number.isFinite(at)&&at<=now&&now-at<=15*DAY;};
const positiveInt=(v:unknown)=>Number.isSafeInteger(Number(v))&&Number(v)>0;
const nonnegativeInt=(v:unknown)=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isSafeInteger(Number(v))&&Number(v)>=0;
/** Pure release checks: data coverage and operational status, not proof of identity or certification. */
export function releaseReadiness(input:ReleaseInput,now=Date.now()){
 const cohort=input.cohort;
 const registered=cohort?.filter(c=>c.registered&&c.hub_ready).length??0;
 const published=cohort?.filter(c=>c.registered&&c.hub_ready&&fresh(c.observed_at,now)&&fresh(c.ranked_at,now)&&positiveInt(c.published_rank)&&nonnegativeInt(c.published_value)).length??0;
 const total=cohort?.length??0;
 const allRegistered=cohort!==null&&registered===total;
 const allPublished=cohort!==null&&published===total;
 const checks:ReleaseCheck[]=[];
 const add=(id:string,label:string,pass:boolean,detail:string)=>checks.push({id,label,status:pass?'pass':'blocked',detail});
 add('guards','Database enforcement',!input.missingTriggers.length&&!input.invalidPointers&&!input.unmatched,input.missingTriggers.length+' missing guards; '+input.invalidPointers+' invalid pointers; '+input.unmatched+' unmatched projections.');
 add('registry','TikTok unique identity and Hub projection',allRegistered,cohort===null?'Central view not installed.':registered+'/'+total+' approved candidates have a registered Hub projection. Owner must verify identity matches.');
 add('publication','TikTok published followers coverage',allRegistered&&allPublished,cohort===null?'Central view not installed.':published+'/'+total+' approved candidates have a fresh matching published followers slot.');
 add('mode','Central public read mode',input.mode==='active','PCI_TIKTOK_CENTRAL='+input.mode+'; enable active only after registry and publication checks pass.');
 add('runtime','Restricted runtime',input.schemaMode==='managed'&&input.runtimeRole==='pci_runtime'&&!input.runtimeFindings.length,'PCI_SCHEMA_MODE='+input.schemaMode+'; backend login '+input.runtimeRole+'. '+(input.runtimeFindings.length?input.runtimeFindings.join(' '):'No role-level findings.'));
 add('ledger','Historical migration ledger',!input.migrationIssues.length,input.migrationIssues.length?input.migrationIssues.join(' '):'No migration ordering issue detected.');
 const missed=input.scheduledDays.filter(d=>d.runs===0).length;
 const duplicates=input.scheduledDays.filter(d=>d.runs>1).length;
 checks.push({id:'scheduler',label:'Daily PKT schedule evidence',status:!input.scheduledDays.length||missed||duplicates?'review':'pass',detail:input.scheduledDays.length?`${missed} missed and ${duplicates} duplicate-run days in the review window. Historical gaps are retained; verify current worker operation.`:'No schedule evidence returned.'});
 return {mode:input.mode,schemaMode:input.schemaMode,cohort:{total,registered,published,viewPresent:cohort!==null},readyForActive:checks.slice(0,3).every(c=>c.status==='pass'),checks,allChecksPassed:checks.every(c=>c.status==='pass')};
}
/** Compare current approved cohort to the real pointer and stored contribution. No public-side ranking. */
export async function readReleaseCohort(db:AuditDb):Promise<CohortRow[]|null>{
 const exists=(await db.query("SELECT to_regclass('public.hub_tiktok_registered') IS NOT NULL AS present")).rows[0]?.present;
 if(!exists)return null;
 return (await db.query(`SELECT s.handle,a.id IS NOT NULL AS registered,v.account_id IS NOT NULL AS hub_ready,v.observed_at,
 rs.breakdown->'contributions'->0->>'observedAt' AS ranked_at,rs.rank AS published_rank,rs.value::text AS published_value
 FROM public.scrappa_candidates s
 LEFT JOIN public.accounts a ON a.platform='tiktok' AND a.external_id=s.external_id AND a.person_id=s.person_id AND a.handle=s.handle
 LEFT JOIN public.hub_tiktok_registered v ON v.account_id=a.id AND v.external_id=s.external_id
 LEFT JOIN public.published_pointers pp ON pp.scope='tiktok.followers'
 LEFT JOIN public.rank_runs r ON r.id=pp.run_id AND r.scope=pp.scope AND r.status='published' AND r.published_at>=s.published_at
 LEFT JOIN public.rank_slots rs ON rs.run_id=r.id AND rs.person_id=s.person_id AND rs.breakdown->'contributions'->0->>'accountId'=a.id::text
 WHERE s.published_at IS NOT NULL ORDER BY s.handle`)).rows as CohortRow[];
}
