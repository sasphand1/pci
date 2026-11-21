import type {Metadata} from 'next';
import {Card,EmptyState,PageHeading} from '@pci/ui';
import {formatCount} from '@/lib/format.mjs';
import {pubGet,pubList,platformName,type PubPerson,type PubPersonDetail} from '@/lib/public';
export const metadata:Metadata={title:'Compare creators'};
const valid=(x:string)=>/^[a-z0-9-]{2,60}$/.test(x);
function total(p:PubPersonDetail,key:'followers'|'views'|'posts30d'){const xs=p.accounts.map(a=>a[key]).filter((x):x is number=>x!==null);return xs.length?xs.reduce((a,b)=>a+b,0):null;}
export default async function Compare({searchParams}:{searchParams:Promise<{left?:string;right?:string}>}){
 const {left='',right=''}=await searchParams;
 const [list,a,b]=await Promise.all([pubList<PubPerson>('/people?limit=100'),valid(left)?pubGet<PubPersonDetail>(`/people/${left}`):null,valid(right)?pubGet<PubPersonDetail>(`/people/${right}`):null]);
 const people=list?.data??[];
 const rows:[string,(p:PubPersonDetail)=>string][]=[
  ['Followers across accounts',p=>formatCount(total(p,'followers'),true)],['YouTube lifetime views',p=>formatCount(total(p,'views'),true)],['Posts in the last 30 days',p=>formatCount(total(p,'posts30d'),true)],
  ['Accounts',p=>p.accounts.map(x=>platformName(x.platform)).join(', ')||'—'],['Most Subscribed rank',p=>{const x=p.positions.find(y=>y.scope==='wheel.subscribed');return x?`#${x.rank}`:'Not ranked';}]];
 return <div className="container"><PageHeading eyebrow="Compare" title="Compare two creators" description="Side by side, from the latest published numbers."/>
  <Card><form className="filters" method="get" action="/compare">{(['left','right'] as const).map(side=><div className="field" key={side}><label htmlFor={`cmp-${side}`}>{side==='left'?'First creator':'Second creator'}</label><select id={`cmp-${side}`} name={side} defaultValue={side==='left'?left:right}><option value="">Choose…</option>{people.map(p=><option key={p.slug} value={p.slug}>{p.displayName}</option>)}</select></div>)}<button className="btn btn-primary" type="submit">Compare</button></form></Card>
  <section className="section">{a&&b?<div className="table-wrap"><table className="data-table"><thead><tr><th scope="col"> </th><th scope="col">{a.displayName}</th><th scope="col">{b.displayName}</th></tr></thead><tbody>{rows.map(([label,f])=><tr key={label}><th scope="row">{label}</th><td>{f(a)}</td><td>{f(b)}</td></tr>)}</tbody></table></div>:<EmptyState title="Choose two creators" message="Pick a creator on each side to see them next to each other."/>}</section></div>;
}
