/** Plain-language view of the Refresh, Rank, Publish flow. Pure functions: no state, no network. */
export type StepKey='refresh'|'rank'|'publish';
export type StepState='waiting'|'active'|'done'|'problem'|'skipped';
export interface FlowStep{key:StepKey;title:string;state:StepState;detail:string}
export interface FlowRun{status:string;steps:{step:string;status:string;detail?:string}[]}
const KEYS:StepKey[]=['refresh','rank','publish'];
const TITLES:Record<StepKey,string>={refresh:'1. Collect numbers',rank:'2. Build rankings',publish:'3. Publish'};
const WAITING:Record<StepKey,string>={refresh:'Reads subscribers, views and posts from YouTube and Instagram',rank:'Orders people by their fresh numbers',publish:'Puts the rankings that pass the checks on the website'};

export function flowSteps(run:FlowRun|undefined,pipelineRunning:boolean,refreshRunning:boolean):FlowStep[]{
  let activeGiven=false;
  return KEYS.map(key=>{
    const entry=run?.steps.find(s=>s.step===key);
    if(entry){
      const state:StepState=entry.status==='ok'?'done':entry.status==='skipped'?'skipped':'problem';
      return {key,title:TITLES[key],state,detail:entry.detail||WAITING[key]};
    }
    if(pipelineRunning&&!activeGiven){activeGiven=true;return {key,title:TITLES[key],state:'active',detail:key==='refresh'?'Collecting numbers. This takes a few minutes for 40 accounts.':WAITING[key]};}
    if(!pipelineRunning&&refreshRunning&&key==='refresh')return {key,title:TITLES[key],state:'active',detail:'Collecting numbers. Do not rank until this has finished.'};
    return {key,title:TITLES[key],state:'waiting',detail:WAITING[key]};
  });
}

export interface Headline{tone:'busy'|'ok'|'attention'|'idle';title:string;text:string}
export function flowHeadline(i:{running:boolean;lastStatus?:string;total:number;rejected:number;liveCount:number}):Headline{
  if(i.running)return {tone:'busy',title:'Updating rankings…',text:'This takes a few minutes. You can leave this page. The website only changes at the last step, and only for rankings that pass the safety checks.'};
  if(!i.lastStatus&&!i.liveCount)return {tone:'idle',title:'Nothing is published yet',text:'Press Update rankings now. It collects the numbers, builds the rankings and publishes the ones that pass the safety checks.'};
  if(i.rejected>0)return {tone:'attention',title:`${i.rejected} of ${i.total} rankings were kept out`,text:'A ranking is kept out when it fails a safety check. Nothing broken was published, and any ranking already live stays as it was. The reasons are below.'};
  if(i.lastStatus==='failed')return {tone:'attention',title:'The last update failed',text:'Nothing on the website was changed. Press Update rankings now to try again. If it fails again, open System health.'};
  return {tone:'ok',title:'Rankings are up to date',text:'The website shows the rankings from the last update. The same update runs by itself every day at 09:00 Asia/Karachi.'};
}

const WHY:Record<string,{why:string;fix:string}>={
  coverage:{why:'A ranking needs a number from the last 7 days for at least half of its people. Too few had one.',fix:'This usually means the numbers were still being collected, or the platform could not be read. Press Update rankings now and wait until all three steps are done.'},
  policy_version:{why:'The ranking rules changed after the draft was made.',fix:'Press Update rankings now to build it again.'},
  non_negative_integers:{why:'A number in the draft did not add up.',fix:'Press Update rankings now. If it repeats, open System health.'},
  unique_people:{why:'A person appeared twice in one ranking.',fix:'Press Update rankings now. If it repeats, open System health.'},
  valid_references:{why:'Someone in the draft was deleted after it was made.',fix:'Press Update rankings now to build it again without them.'},
  slots_gap_free:{why:'The positions in the draft had a gap.',fix:'Press Update rankings now. If it repeats, open System health.'},
  rank_consistent:{why:'The order did not follow the numbers.',fix:'Press Update rankings now. If it repeats, open System health.'},
  input_hash:{why:'The draft changed after it was checked.',fix:'Press Update rankings now to build it again.'},
};
const FALLBACK={why:'The draft failed a safety check.',fix:'Press Update rankings now. If it repeats, open System health.'};
export const plainGate=(gate:string)=>WHY[gate]??FALLBACK;

/** Groups rejected drafts by the first check they failed, so eleven rankings that failed for one reason read as one reason. */
export function rejectedReasons(drafts:{scope:string;status:string;gateFailures:{gate:string;message:string}[]}[]){
  const groups=new Map<string,{gate:string;example:string;scopes:string[]}>();
  for(const d of drafts){
    if(d.status!=='rejected'||!d.gateFailures.length)continue;
    const g=d.gateFailures[0];
    const cur=groups.get(g.gate)??{gate:g.gate,example:g.message,scopes:[]};
    cur.scopes.push(d.scope);groups.set(g.gate,cur);
  }
  return [...groups.values()].map(g=>({...g,...plainGate(g.gate)}));
}

/** Plain text for the system status reasons shown on the Pipeline page. */
export function plainSystemReason(reason:string):string{
  if(/worker has not been seen|worker stopped/i.test(reason))return `${reason}. The 09:00 daily update cannot run by itself until Module 1 has RUN_WORKER_IN_API=true (then redeploy). You can still press Update rankings now by hand.`;
  return reason;
}
