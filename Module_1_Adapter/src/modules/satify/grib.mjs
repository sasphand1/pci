// Minimal GRIB decoder for Copernicus downloads (CAMS via ADS, GloFAS via EWDS).
// Supports GRIB1 and GRIB2, grid-point simple packing, bitmaps, regular lat/lon grids and all scanning modes.
// Anything else (e.g. CCSDS or JPEG packing, Gaussian grids) is reported by name so the admin panel shows it.
const u16=(b,o)=>b[o]<<8|b[o+1];
const u24=(b,o)=>b[o]<<16|b[o+1]<<8|b[o+2];
const u32=(b,o)=>(b[o]*16777216)+(b[o+1]<<16|b[o+2]<<8|b[o+3]);
const s16=(b,o)=>{const v=u16(b,o);return v&0x8000?-(v&0x7fff):v;};
const s24=(b,o)=>{const v=u24(b,o);return v&0x800000?-(v&0x7fffff):v;};
const s32=(b,o)=>{const v=u32(b,o);return v>=0x80000000?-(v-0x80000000):v;};
function ibm(b,o){const sign=b[o]&0x80?-1:1,exp=(b[o]&0x7f)-64,mant=u24(b,o+1);return sign*mant*Math.pow(16,exp-6);}
function f32(b,o){return new DataView(b.buffer,b.byteOffset+o,4).getFloat32(0,false);}
const UNIT_MS={0:60e3,1:3600e3,2:86400e3,10:3*3600e3,11:6*3600e3,12:12*3600e3,13:1e3};

function unpack(b,start,count,nbits){
 const out=new Float64Array(count);if(nbits===0)return out;
 let bit=start*8;
 for(let i=0;i<count;i++){let v=0;for(let k=0;k<nbits;k++,bit++)v=v*2+((b[bit>>3]>>(7-(bit&7)))&1);out[i]=v;}
 return out;
}
function popcount(bm,total){let n=0;for(let i=0;i<total;i++)if((bm[i>>3]>>(7-(i&7)))&1)n++;return n;}
/** Fills missing increments from the grid corners. */
function fixGrid(g){
 const span=(a,c)=>Math.abs(c-a);
 // Corners are authoritative: a missing or inconsistent increment is recomputed from them.
 const lonSpan=span(g.lon1,g.lon2>=g.lon1?g.lon2:g.lon2+360),latSpan=span(g.lat1,g.lat2);
 if(g.ni>1&&(!(g.di>0&&g.di<360)||Math.abs(g.di*(g.ni-1)-lonSpan)>g.di/2))g.di=lonSpan/(g.ni-1);
 if(g.nj>1&&(!(g.dj>0&&g.dj<180)||Math.abs(g.dj*(g.nj-1)-latSpan)>g.dj/2))g.dj=latSpan/(g.nj-1);
 return g;
}
function expand(packed,bitmap,total){
 if(!bitmap)return packed;
 const out=new Float64Array(total).fill(NaN);let k=0;
 for(let i=0;i<total;i++)if((bitmap[i>>3]>>(7-(i&7)))&1)out[i]=packed[k++];
 return out;
}

function grib1(b,o,len){
 let p=o+8;const pdsLen=u24(b,p);
 const table=b[p+3],param=b[p+8],flags=b[p+7],levelType=b[p+9];
 const century=b[p+24]||21,year=(century-1)*100+b[p+12];
 const ref=Date.UTC(year,b[p+13]-1,b[p+14],b[p+15],b[p+16]);
 const unit=UNIT_MS[b[p+17]]??3600e3,P1=b[p+18],P2=b[p+19],tri=b[p+20];
 const step=tri===10?u16(b,p+18):(tri===2||tri===3||tri===4||tri===5)?P2:P1;
 const D=s16(b,p+26);p+=pdsLen;
 if(!(flags&0x80))throw Error('GRIB1 without grid section');
 const gdsLen=u24(b,p);if(b[p+5]!==0)throw Error(`GRIB1 grid type ${b[p+5]} not supported (regular lat/lon only)`);
 const grid={ni:u16(b,p+6),nj:u16(b,p+8),lat1:s24(b,p+10)/1000,lon1:s24(b,p+13)/1000,lat2:s24(b,p+17)/1000,lon2:s24(b,p+20)/1000,
  di:u16(b,p+23)===0xffff?NaN:u16(b,p+23)/1000,dj:u16(b,p+25)===0xffff?NaN:u16(b,p+25)/1000,scan:b[p+27]};fixGrid(grid);
 p+=gdsLen;let bitmap=null;
 if(flags&0x40){const bmsLen=u24(b,p);if(u16(b,p+4)!==0)throw Error('GRIB1 predefined bitmap not supported');bitmap=b.subarray(p+6,p+bmsLen);p+=bmsLen;}
 const bdsLen=u24(b,p),bflags=b[p+3]>>4,unused=b[p+3]&15;
 if(bflags&0x8)throw Error('GRIB1 spherical harmonics not supported');if(bflags&0x4)throw Error('GRIB1 complex packing not supported');
 const E=s16(b,p+4),R=ibm(b,p+6),nbits=b[p+10];
 const total=grid.ni*grid.nj;
 const count=bitmap?popcount(bitmap,total):total;
 const packed=unpack(b,p+11,count,nbits);
 const scale=Math.pow(2,E),dec=Math.pow(10,-D);
 for(let i=0;i<packed.length;i++)packed[i]=(R+packed[i]*scale)*dec;
 return [{edition:1,param:`${table}.${param}`,levelType,refTime:new Date(ref).toISOString(),validTime:new Date(ref+step*unit).toISOString(),...grid,values:expand(packed,bitmap,total)}];
}

function grib2(b,o,len){
 const end=o+len;let p=o+16;const discipline=b[o+6];
 let ref=null,grid=null,prod=null,pack=null,bitmap=null,lastBitmap=null;const out=[];
 while(p<end-4){
  if(b[p]===0x37&&b[p+1]===0x37&&b[p+2]===0x37&&b[p+3]===0x37)break;
  const sl=u32(b,p),sn=b[p+4];if(sl<5)throw Error('Corrupt GRIB2 section');
  if(sn===1){ref=Date.UTC(u16(b,p+12),b[p+14]-1,b[p+15],b[p+16],b[p+17],b[p+18]);}
  else if(sn===3){const t=u16(b,p+12);if(t!==0)throw Error(`GRIB2 grid template 3.${t} not supported (regular lat/lon only)`);
   const basic=u32(b,p+38),sub=u32(b,p+42),f=(basic===0||basic===0xffffffff)?1e-6:basic/(sub||1);
   grid={ni:u32(b,p+30),nj:u32(b,p+34),lat1:s32(b,p+46)*f,lon1:s32(b,p+50)*f,lat2:s32(b,p+55)*f,lon2:s32(b,p+59)*f,di:u32(b,p+63)===0xffffffff?NaN:u32(b,p+63)*f,dj:u32(b,p+67)===0xffffffff?NaN:u32(b,p+67)*f,scan:b[p+71]};fixGrid(grid);}
  else if(sn===4){const t=u16(b,p+7);
   const unit=UNIT_MS[b[p+17]]??3600e3,ft=s32(b,p+18);let valid=ref+ft*unit;
   const endAt=t===8?p+34:t===11?p+37:t===9?p+46:t===12?p+36:null;
   if(endAt!==null&&u16(b,endAt)>1900)valid=Date.UTC(u16(b,endAt),b[endAt+2]-1,b[endAt+3],b[endAt+4],b[endAt+5],b[endAt+6]);
   prod={template:t,param:`${discipline}.${b[p+9]}.${b[p+10]}`,levelType:b[p+22],validTime:valid};}
  else if(sn===5){const t=u16(b,p+9);if(t!==0)throw Error(`GRIB2 packing template 5.${t} not supported (simple packing only)`);
   pack={n:u32(b,p+5),R:f32(b,p+11),E:s16(b,p+15),D:s16(b,p+17),nbits:b[p+19]};}
  else if(sn===6){const ind=b[p+5];if(ind===0){bitmap=b.subarray(p+6,p+sl);lastBitmap=bitmap;}else if(ind===254)bitmap=lastBitmap;else if(ind===255)bitmap=null;else throw Error('GRIB2 predefined bitmap not supported');}
  else if(sn===7){
   if(!grid||!prod||!pack||ref===null)throw Error('GRIB2 data section before its definitions');
   const total=grid.ni*grid.nj;const packed=unpack(b,p+5,pack.n,pack.nbits);
   const scale=Math.pow(2,pack.E),dec=Math.pow(10,-pack.D);
   for(let i=0;i<packed.length;i++)packed[i]=(pack.R+packed[i]*scale)*dec;
   out.push({edition:2,param:prod.param,levelType:prod.levelType,refTime:new Date(ref).toISOString(),validTime:new Date(prod.validTime).toISOString(),...grid,values:expand(packed,bitmap,total)});
  }
  p+=sl;
 }
 return out;
}

/** Decodes every GRIB message in a buffer (GRIB1 and GRIB2 may be mixed). */
export function decodeGrib(buf){
 const b=buf instanceof Uint8Array?buf:new Uint8Array(buf);const fields=[];let o=0;
 while(o<b.length-8){
  if(!(b[o]===0x47&&b[o+1]===0x52&&b[o+2]===0x49&&b[o+3]===0x42)){o++;continue;}
  const ed=b[o+7];
  if(ed===1){const len=u24(b,o+4);fields.push(...grib1(b,o,len));o+=len;}
  else if(ed===2){const len=u32(b,o+12);fields.push(...grib2(b,o,len));o+=len;}
  else throw Error(`Unknown GRIB edition ${ed}`);
 }
 if(!fields.length)throw Error('No GRIB messages in the download');
 return fields;
}

/** Value at the grid point nearest to lat/lon (NaN when missing or outside the grid). */
export function valueAt(f,lat,lon){
 const iNeg=(f.scan&0x80)!==0,jPos=(f.scan&0x40)!==0,colMajor=(f.scan&0x20)!==0,boustro=(f.scan&0x10)!==0;
 const norm=x=>((x%360)+360)%360;
 const dLon=iNeg?norm(f.lon1-lon):norm(lon-f.lon1);
 const i=Math.round(dLon/f.di),j=Math.round((jPos?lat-f.lat1:f.lat1-lat)/f.dj);
 if(i<0||j<0||i>=f.ni||j>=f.nj)return NaN;
 // Scanning mode bit 0x10: every second row (or column) runs the opposite way.
 const ii=boustro&&!colMajor&&j%2===1?f.ni-1-i:i,jj=boustro&&colMajor&&i%2===1?f.nj-1-j:j;
 const v=f.values[colMajor?ii*f.nj+jj:jj*f.ni+ii];
 return v===undefined?NaN:v;
}
