/** Compact audience figure: 1,234 / 12.4K / 8.9M / 1.2B. */
export function compact(n:number):string{
 if(!Number.isFinite(n)||n<0)return '0';
 const f=(x:number,s:string)=>`${Math.round(x*10)/10}${s}`;
 if(n>=1e9)return f(n/1e9,'B');
 if(n>=1e6)return f(n/1e6,'M');
 if(n>=1e4)return f(n/1e3,'K');
 return n.toLocaleString('en-US');
}
export function initials(name:string):string{
 return name.split(/\s+/).filter(Boolean).slice(0,2).map(p=>p[0]?.toUpperCase()).join('')||'?';
}
/** "+1.8%" / "-3%" / null when the change cannot be computed honestly. */
export function signedPct(v:number|null):string|null{
 if(v===null||!Number.isFinite(v))return null;
 return `${v>0?'+':''}${v}%`;
}
