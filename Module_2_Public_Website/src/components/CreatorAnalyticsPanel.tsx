'use client';

import {useState} from 'react';
import {formatCount} from '@/lib/format.mjs';
import {earningsStatusLabel} from '@/lib/earnings-status.mjs';
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
  const video=data.video??{sampledVideos:0,averageViews:null,topVideos:[],videos:[]};
  const milestone=data.milestone??null;
  return <section className="section pci-analytics" aria-label="Creator growth and earnings">
    <h2>Creator Analytics</h2>
    <p className="fineprint">Observed public YouTube data. Graphs include only real observations; missing days are not invented.</p>
    <div className="pci-analytics-summary">
      <div className="pci-analytics-tile"><small>Subscriber change · 7 days</small><strong>{signed(data.growth.subscribers['7d'])}</strong></div>
      <div className="pci-analytics-tile"><small>Channel views gained · 30 days</small><strong>{signed(data.growth.views['30d'])}</strong></div>
      <div className="pci-analytics-tile pci-analytics-revenue"><small>Estimated Monthly Earnings</small><strong>{data.estimatedMonthlyEarningsUsd===null?earningsStatusLabel(data.earningsStatus):usd(data.estimatedMonthlyEarningsUsd)}</strong><span>{data.earningsBasis==='recent_uploads_floor'?'Recent-upload lower bound; excludes older videos':'Modeled estimate, not verified revenue'}</span></div>
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
    <div className="pci-video-analytics">
      <div className="pci-analytics-subheading"><h3>Video performance</h3><span className="fineprint">Latest collected YouTube uploads · public view counts</span></div>
      <div className="pci-analytics-summary pci-analytics-video-summary">
        <div className="pci-analytics-tile"><small>Videos sampled</small><strong>{video.sampledVideos}</strong></div>
        <div className="pci-analytics-tile"><small>Average views per sampled video</small><strong>{video.averageViews===null?'Collecting':formatCount(video.averageViews,true)}</strong></div>
        <div className="pci-analytics-tile"><small>Next subscriber milestone</small><strong>{milestone?formatCount(milestone.target,true):'Collecting'}</strong><span>{milestone?.estimatedDays!=null?`Trend projection: ~${milestone.estimatedDays} days`:'No reliable projection yet'}</span></div>
      </div>
      {video.videos.length>0?<div className="table-wrap pci-video-table-wrap"><table className="data-table pci-video-table">
        <thead><tr><th>Video</th><th>Current views</th><th>At 24h</th><th>At 7d</th><th>At 30d</th><th>Views/hour</th><th>Breakout</th></tr></thead>
        <tbody>{video.videos.map(v=><tr key={v.videoId}>
          <td><a href={`https://www.youtube.com/watch?v=${encodeURIComponent(v.videoId)}`} target="_blank" rel="noopener noreferrer">{v.title}</a><small>{v.publishedAt?new Date(v.publishedAt).toLocaleDateString('en-GB',{dateStyle:'medium'}):'Upload date unavailable'}</small></td>
          <td>{v.currentViews===null?'—':formatCount(v.currentViews,true)}</td>
          <td>{v.views24h===null?'—':formatCount(v.views24h,true)}</td>
          <td>{v.views7d===null?'—':formatCount(v.views7d,true)}</td>
          <td>{v.views30d===null?'—':formatCount(v.views30d,true)}</td>
          <td>{v.velocityPerHour===null?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(v.velocityPerHour)}</td>
          <td>{v.breakoutFactor!==null&&v.breakoutFactor>=1.5?`${v.breakoutFactor.toFixed(1)}×`:'—'}</td>
        </tr>)}</tbody>
      </table></div>:<p className="pci-analytics-empty">Video-level observations are being collected. Historical 24h, 7d and 30d figures cannot be reconstructed retroactively.</p>}
      {video.topVideos.length>0&&<div className="pci-top-videos"><h3>Top videos in the tracked sample</h3><ol>{video.topVideos.map(v=><li key={v.videoId}><a target="_blank" rel="noopener noreferrer" href={`https://www.youtube.com/watch?v=${encodeURIComponent(v.videoId)}`}>{v.title}</a><strong>{formatCount(v.views,true)} views</strong></li>)}</ol></div>}
      <p className="fineprint">24h/7d/30d are cumulative views sampled near each video-age milestone, not view gains during those periods. Blank values mean no sufficiently timed observation. Views/hour uses actual successive samples. Breakout compares observed first-day views with at least three older videos.</p>
    </div>
    <p className="pci-analytics-disclaimer">Earnings use the $0.25–$4.00 Social Blade RPM range midpoint ($2.125 per 1,000 views). With 20+ hours of real channel-view snapshots we project a 30-day pace. Provisional estimates instead count only views on uploads published within the past 30 days; they exclude all views on older videos and may materially understate the channel's activity. All amounts are hypothetical, not actual creator income; missing readings never become fabricated earnings.</p>
  </section>;
}
