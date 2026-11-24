// Pure helpers for the Creators page: links, labels and compare maths. No dependencies.
export const MAX_COMPARE=4;
const SLUG=/^[a-z0-9-]{2,60}$/;

/** Up to four distinct, well-formed slugs from a comma-separated value, in order. */
export function parseCompare(value){
  const raw=typeof value==='string'?value.split(','):[];
  const out=[];
  for(const s of raw.map(x=>x.trim().toLowerCase()))if(SLUG.test(s)&&!out.includes(s))out.push(s);
  return out.slice(0,MAX_COMPARE);
}
export const toggleSlug=(list,slug)=>list.includes(slug)?list.filter(x=>x!==slug):list.length>=MAX_COMPARE?list:[...list,slug];

/** Link to the Creators page with the given filters; empty and default values are left out. */
export function creatorsHref({search='',category='',platform='',sort='rank',view='list',page=1,compare=[],open=false}={}){
  const p=new URLSearchParams();
  if(search)p.set('search',search);
  if(category)p.set('category',category);
  if(platform)p.set('platform',platform);
  if(sort&&sort!=='rank')p.set('sort',sort);
  if(view&&view!=='list')p.set('view',view);
  if(page>1)p.set('page',String(page));
  if(compare.length)p.set('compare',compare.join(','));
  if(compare.length&&open)p.set('open','1');
  const s=p.toString();
  return s?`/creators?${s}`:'/creators';
}

/** "as of 20 Nov 2026" for a last-known figure; empty when there is no date. */
export function asOfLabel(iso){
  if(!iso)return '';
  const t=new Date(iso);
  if(!Number.isFinite(t.valueOf()))return '';
  return `as of ${t.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'})}`;
}

/** Index of the single highest value, or -1 when nothing is available or the top value is tied. Missing never wins. */
export function leaderIndex(values){
  let best=-1,bestValue=null,tied=false;
  values.forEach((v,i)=>{
    if(typeof v!=='number'||!Number.isFinite(v))return;
    if(bestValue===null||v>bestValue){best=i;bestValue=v;tied=false;}
    else if(v===bestValue)tied=true;
  });
  return tied?-1:best;
}
/** Bar length from 0 to 100 relative to the largest value; missing is null (no bar), never zero. */
export function barPercent(value,values){
  if(typeof value!=='number'||!Number.isFinite(value)||value<0)return null;
  const max=Math.max(0,...values.filter(v=>typeof v==='number'&&Number.isFinite(v)));
  return max>0?Math.round((value/max)*100):0;
}
export const accountFollowers=(row,platform)=>{
  const xs=(row.accounts||[]).filter(a=>a.platform===platform&&typeof a.followers==='number').map(a=>a.followers);
  return xs.length?xs.reduce((a,b)=>a+b,0):null;
};
