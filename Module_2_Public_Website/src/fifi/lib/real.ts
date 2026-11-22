// Maps the real published data onto the shapes the Fifi design components already use.
import {formatCompact,formatPercent,growthPercent,toCreatorCards} from '@/lib/fifi.mjs';
import type {PubPerson,PubRanking} from '@/lib/public';
import type {PublicEventRow} from '@/lib/event-table.mjs';
import type {Creator,EventItem} from '@/fifi/lib/fifi-data';

export type RealCreator=Creator&{slug:string};
const MONTHS=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const FULL_MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];

export function personToCreator(p:PubPerson,index:number,followers='',growth='Not available'):RealCreator{
  const first=p.accounts[0];
  return {id:index+1,slug:p.slug,name:p.displayName,handle:first?first.handle:'',category:p.categories[0]?.label??'Creator',city:'Pakistan',followers:followers||'Not available',growth,image:p.avatarUrl??'',bio:''};
}
export function rankingToCreators(r:PubRanking|null|undefined,limit:number):RealCreator[]{
  return toCreatorCards(r,limit).map((c,i)=>({id:c.rank||i+1,slug:c.slug,name:c.name,handle:'',category:c.category??'Creator',city:'Pakistan',followers:c.value===null?'Not available':formatCompact(c.value),growth:'Not available',image:c.avatarUrl??'',bio:''}));
}
export function eventRowToItem(e:PublicEventRow,index=0):EventItem{
  const d=new Date(e.start_ms+5*3600e3); // Pakistan time
  return {id:index+1,title:e.name,day:String(d.getUTCDate()).padStart(2,'0'),month:MONTHS[d.getUTCMonth()],dateLabel:`${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${FULL_MONTHS[d.getUTCMonth()]}`,city:e.city,venue:e.venue,category:e.category,price:e.admission==='free'?'Free entry':e.admission==='paid'?'Paid':'See organiser',image:'',description:e.source_name?`Source: ${e.source_name}`:''};
}
export const pct=(current:number|null|undefined,gain:number|null|undefined)=>formatPercent(growthPercent(current??null,gain??null));
