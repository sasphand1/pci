// Pure chart geometry. Values that are null stay gaps: they are never drawn as zero.

export type Box={width:number;height:number;left:number;right:number;top:number;bottom:number};

export function niceMax(values:(number|null)[][]):number{
 const m=Math.max(0,...values.flatMap(v=>v.filter((x):x is number=>x!==null)));
 if(m<=0)return 1;
 const pow=Math.pow(10,Math.floor(Math.log10(m)));
 for(const step of [1,1.5,2,3,5,7.5,10]) if(step*pow>=m)return step*pow;
 return 10*pow;
}

export function xAt(i:number,count:number,b:Box):number{
 const inner=b.width-b.left-b.right;
 return count<=1?b.left+inner/2:Math.round((b.left+inner*(i/(count-1)))*10)/10;
}
export function yAt(v:number,max:number,b:Box):number{
 const inner=b.height-b.top-b.bottom;
 return Math.round((b.top+inner*(1-Math.min(Math.max(v,0),max)/max))*10)/10;
}

/** One path per unbroken run of values; a null starts a new run. */
export function linePath(values:(number|null)[],max:number,b:Box):string{
 let d='';let open=false;
 values.forEach((v,i)=>{
  if(v===null){open=false;return;}
  d+=`${open?'L':'M'}${xAt(i,values.length,b)},${yAt(v,max,b)}`;open=true;
 });
 return d;
}

export function lastPoint(values:(number|null)[],max:number,b:Box):{x:number;y:number;value:number}|null{
 for(let i=values.length-1;i>=0;i--){const v=values[i];if(v!==null)return {x:xAt(i,values.length,b),y:yAt(v,max,b),value:v};}
 return null;
}
