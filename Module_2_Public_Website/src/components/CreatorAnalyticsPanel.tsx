'use client';

import {useState} from 'react';
import {formatCount} from '@/lib/format.mjs';
import type {PubCreatorAnalytics} from '@/lib/public';

type Metric='subscribers'|'views';
type Span=7|30|90;
const usd=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const signed=(n:number|null)=>n===null?'N/A':`${n>0?'+':''}${formatCount(n,true)}`;

function trendPath(points:{at:string;value:number}[]){
  if(points.length<2) return null;
  const ts=points.map(p=>Date.parse(p.at));
  const t0=ts[0],dt=ts.at(-1)!-t0;
  const lo=Math.min(...points.map(p=>p.value)),hi=Math.max(...points.map(p=>p.value));
  if(!Number.isFinite(dt)||dt<=0) return null;
  return points.map((p,i)=>`${i===0?'M':'L'}${(12+(ts[i]-t0)/dt*596).toFixed(2)} ${(130-(p.value-lo)/(hi-lo||1)*116).toFixed(2)}`).join(' ');
}

export function CreatorAnalyticsPanel({data}:{data:PubCreatorAnalytics}){
  const [metric,setMetric]=useState<Metric>('subscribers');
  const [span,setSpan]=useState<Span>(30);
  const history=data.history[metric];
  const latest=history.at(-1);
  const cutoff=latest?Date.parse(latest.at)-span*86_400_000:0;
  const visible=history.filter(p=>Date.parse(p.at)>=cutoff);
  const d=trendPath(visible);
  return <section className="section pci-analytics" aria-label="Creator growth and earnings">
    <h2>Creator Analytics</h2>
    <p className="fineprint">Observed public YouTube data. Graphs include only real observations; missing days are not invented.</p>
    <div className="pci-analytics-summary">
      <div className="pci-analytics-tile"><small>Subscriber change · 7 days</small><strong>{signed(data.growth.subscribers['7d'])}</strong></div>
      <div className="pci-analytics-tile"><small>Channel views gained · 30 days</small><strong>{signed(data.growth.views['30d'])}</strong></div>
      <div className="pci-analytics-tile pci-analytics-revenue"><small>Estimated Monthly Earnings</small><strong>{data.estimatedMonthlyEarningsUsd===null?'N/A':usd(data.estimatedMonthlyEarningsUsd)}</strong><span>Modeled estimate, not verified revenue</span></div>
    </div>
    <div className="pci-analytics-graph">
      <div className="pci-analytics-toolbar">
        <div className="pci-analytics-controls" role="group" aria-label="Historical metric">
          {(['subscribers','views'] as Metric[]).map(m=><button type="button" key={m} aria-pressed={metric===m} onClick={()=>setMetric(m)}>{m==='subscribers'?'Subscribers':'Views'}</button>)}
        </div>
        <div className="pci-analytics-controls" role="group" aria-label="Historical time period">
          {([7,30,90] as Span[]).map(p=><button type="button" key={p} aria-pressed={span===p} onClick={()=>setSpan(p)}>{p}D</button>)}
        </div>
      </div>
      {d?<>
        <svg viewBox="0 0 620 148" role="img" aria-label={`${metric} trend over observed history`} className="pci-analytics-svg" preserveAspectRatio="none">
          <path d="M12 14 H608 M12 72 H608 M12 130 H608" className="pci-analytics-grid" />
          <path d={d} className="pci-analytics-chart-path" />
        </svg>
        <div className="pci-analytics-axis"><span>{new Date(visible[0].at).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'})}</span><span>{new Date(visible.at(-1)!.at).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'})}</span></div>
      </>:<p className="pci-analytics-empty">Not enough historical observations to draw this trend yet.</p>}
      <div className="pci-analytics-gains">
        {(['24h','7d','30d'] as const).map(p=><div key={p}><small>{p} growth</small><strong>{signed(data.growth[metric][p])}</strong></div>)}
      </div>
      {data.historyAccountCount>1&&<p className="fineprint">Trend shown for the first linked YouTube channel. The earnings model covers all linked YouTube channels when data is complete.</p>}
    </div>
    <p className="pci-analytics-disclaimer">Earnings use Social Blade's assumed $0.25–$4.00 RPM range midpoint ($2.125 per 1,000 views), applied to the normalized 30-day pace of observed channel-view gains. This is a hypothetical estimate, not actual creator income. N/A means insufficient reliable history.</p>
  </section>;
}
