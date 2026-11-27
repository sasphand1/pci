export const VIEW_BANDS=['<10K','10–25K','25–50K','50–100K','100–250K','250K–1M','1M+'];
export function localBands(rows){return rows.slice(0,Math.max(3,rows.findLastIndex(r=>r.value>0)+1));}
/** Align backend-computed points by date for a grouped chart; never derive a rate in Module 2. */
export function alignDaily(peers){const maps=peers.map(p=>new Map(p.dailyRates.map(r=>[r.time,r.value])));return [...new Set(maps.flatMap(m=>[...m.keys()]))].sort((a,b)=>a-b).slice(-14).map(time=>({day:new Date(time+5*3600000).toISOString().slice(0,10),values:maps.map(m=>m.get(time)??null)}));}
