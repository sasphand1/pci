import type {OverviewSeries} from '@/lib/types';
import {compact} from '@/lib/format';
import {lastPoint,linePath,niceMax,xAt,yAt,type Box} from '@/lib/chart';

const BOX:Box={width:600,height:220,left:8,right:44,top:18,bottom:26};
const dayLabel=(iso:string)=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(`${iso}T00:00:00Z`));

/** Two lines on ONE scale from zero, so their sizes compare honestly. Days without a reading are gaps. */
export function AudienceChart({series}:{series:OverviewSeries}){
 const count=series.days.length;
 const hasYt=series.youtube.some(v=>v!==null),hasIg=series.instagram.some(v=>v!==null);
 if(count<2||(!hasYt&&!hasIg))return <p className="chart-empty">History builds up as the numbers are refreshed each day. The chart appears after two days of readings.</p>;
 const max=niceMax([series.youtube,series.instagram]);
 const ticks=[0,0.5,1].map(f=>({v:max*f,y:yAt(max*f,max,BOX)}));
 const ytEnd=lastPoint(series.youtube,max,BOX),igEnd=lastPoint(series.instagram,max,BOX);
 const summary=`Audience over ${count} days. ${ytEnd?`YouTube ${compact(ytEnd.value)}. `:''}${igEnd?`Instagram ${compact(igEnd.value)}.`:''}`;
 return <svg className="chart" viewBox={`0 0 ${BOX.width} ${BOX.height}`} role="img" aria-label={summary}>
  {ticks.map(t=><g key={t.v}><line className="chart-grid" x1={BOX.left} x2={BOX.width-BOX.right} y1={t.y} y2={t.y}/><text className="chart-tick" x={BOX.width-BOX.right+6} y={t.y+4}>{compact(t.v)}</text></g>)}
  {hasYt&&<path className="chart-line chart-yt" d={linePath(series.youtube,max,BOX)} fill="none"/>}
  {hasIg&&<path className="chart-line chart-ig" d={linePath(series.instagram,max,BOX)} fill="none"/>}
  {ytEnd&&<circle className="chart-dot chart-yt-dot" cx={ytEnd.x} cy={ytEnd.y} r="5"/>}
  {igEnd&&<circle className="chart-dot chart-ig-dot" cx={igEnd.x} cy={igEnd.y} r="5"/>}
  <text className="chart-tick" x={xAt(0,count,BOX)} y={BOX.height-6}>{dayLabel(series.days[0])}</text>
  <text className="chart-tick chart-tick-end" x={xAt(count-1,count,BOX)} y={BOX.height-6}>{dayLabel(series.days[count-1])}</text>
 </svg>;
}
