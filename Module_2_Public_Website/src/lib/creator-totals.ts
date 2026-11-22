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