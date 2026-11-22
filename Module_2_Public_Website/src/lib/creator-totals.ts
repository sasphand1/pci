import type {PubRanking} from './public';

/** Only display a sum when the published ranking contains the whole population. */
export function publishedTotal(sorts:PubRanking[]|null|undefined,scope:string):string {
  const ranking=sorts?.find(s=>s.scope===scope);
  if(!ranking || !ranking.population || ranking.stale || ranking.entries.length!==ranking.population || ranking.covered!==ranking.population) return 'N/A';
  let sum=0;
  const seen=new Set<string>();
  for(const entry of ranking.entries){
    if(!entry.person?.slug || seen.has(entry.person.slug) || !Number.isSafeInteger(entry.value) || entry.value<0) return 'N/A';
    seen.add(entry.person.slug);
    sum+=entry.value;
    if(!Number.isSafeInteger(sum)) return 'N/A';
  }
  return new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(sum);
}
/** Sum only the returned, published ranks. Never label a partial sample as a national total. */
export function publishedRankedTotal(sorts:PubRanking[]|null|undefined,scope:string):string {
  const ranking=sorts?.find(s=>s.scope===scope);
  if(!ranking||ranking.stale||!ranking.entries.length)return 'N/A';
  const seen=new Set<string>();let total=0;
  for(const e of ranking.entries){
    if(!e.person?.slug||seen.has(e.person.slug)||!Number.isSafeInteger(e.value)||e.value<0)return 'N/A';
    seen.add(e.person.slug);total+=e.value;
    if(!Number.isSafeInteger(total))return 'N/A';
  }
  return new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(total);
}
