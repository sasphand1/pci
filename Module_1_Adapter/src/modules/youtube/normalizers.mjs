/** Pure YouTube input conversions shared by the connector and deterministic tests. */
export function chunks(items,size){
 if(!Number.isInteger(size)||size<1)throw new RangeError('chunk size must be a positive integer');
 const result=[];for(let i=0;i<items.length;i+=size)result.push(items.slice(i,i+size));return result;
}
export function countOrNull(v){
 if(typeof v!=='string'|| !/^\d+$/.test(v))return null;
 const n=BigInt(v);
 if(n>9223372036854775807n)throw new RangeError('YouTube count exceeds PostgreSQL signed BIGINT');
 return n.toString();
}
export function dateOrNull(v){
 if(typeof v!=='string'||Number.isNaN(Date.parse(v)))return null;
 return new Date(v).toISOString();
}
export function thumbUrl(v){
 const u=v?.thumbnails?.high?.url??v?.thumbnails?.medium?.url??v?.thumbnails?.default?.url;
 if(!u)return null;
 try{const p=new URL(u);return p.protocol==='https:'?u:null;}catch{return null;}
}
/** Exact nearest-integer rounding of a nonnegative bigint total. Returns null on missing samples. */
export function roundedMean(total,n){
 if(!Number.isInteger(n)||n<0)throw new RangeError('Sample count cannot be negative');
 if(n===0)return null;
 const count=BigInt(n);
 return ((BigInt(total)+count/2n)/count).toString();
}
