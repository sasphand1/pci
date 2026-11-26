/** Minimal QR code encoder (byte mode, error correction level M, versions 1–40), after Project Nayuki's
 * public-domain-style reference algorithm (MIT). Used for the Satify "scan to join on WhatsApp" codes,
 * so no extra npm package is needed. Returns a square boolean matrix (true = dark). */
const ECC_M=[-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28];
const BLOCKS_M=[-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49];

function rawModules(ver:number){let r=(16*ver+128)*ver+64;if(ver>=2){const n=Math.floor(ver/7)+2;r-=(25*n-10)*n-55;if(ver>=7)r-=36;}return r;}
const dataCodewords=(ver:number)=>Math.floor(rawModules(ver)/8)-ECC_M[ver]*BLOCKS_M[ver];
function alignPositions(ver:number){if(ver===1)return [];const n=Math.floor(ver/7)+2,size=ver*4+17;
 const step=ver===32?26:Math.ceil((ver*4+4)/(n*2-2))*2;const out=[6];for(let p=size-7;out.length<n;p-=step)out.splice(1,0,p);return out;}
function gfMul(x:number,y:number){let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11d);z^=((y>>>i)&1)*x;}return z&0xff;}
function rsDivisor(deg:number){const r=new Array(deg).fill(0);r[deg-1]=1;let root=1;
 for(let i=0;i<deg;i++){for(let j=0;j<r.length;j++){r[j]=gfMul(r[j],root);if(j+1<r.length)r[j]^=r[j+1];}root=gfMul(root,0x02);}return r;}
function rsRemainder(data:number[],div:number[]){const r=new Array(div.length).fill(0);
 for(const b of data){const f=b^(r.shift() as number);r.push(0);div.forEach((c,i)=>{r[i]^=gfMul(c,f);});}return r;}

export function qrMatrix(text:string):boolean[][]{
 const bytes=[...new TextEncoder().encode(text)];
 let ver=1;for(;ver<=40;ver++){const cc=ver<=9?8:16;if(4+cc+bytes.length*8<=dataCodewords(ver)*8)break;}
 if(ver>40)throw new Error('Text too long for a QR code');
 const bits:number[]=[];const put=(v:number,n:number)=>{for(let i=n-1;i>=0;i--)bits.push((v>>>i)&1);};
 put(4,4);put(bytes.length,ver<=9?8:16);for(const b of bytes)put(b,8);
 const cap=dataCodewords(ver)*8;put(0,Math.min(4,cap-bits.length));put(0,(8-bits.length%8)%8);
 for(let pad=0xec;bits.length<cap;pad^=0xec^0x11)put(pad,8);
 const data:number[]=[];for(let i=0;i<bits.length;i+=8)data.push(parseInt(bits.slice(i,i+8).join(''),2));
 // Split into blocks, add error correction, interleave.
 const nb=BLOCKS_M[ver],ecl=ECC_M[ver],raw=Math.floor(rawModules(ver)/8),nShort=nb-raw%nb,shortLen=Math.floor(raw/nb);
 const div=rsDivisor(ecl);const blocks:number[][]=[];
 for(let i=0,k=0;i<nb;i++){const d=data.slice(k,k+shortLen-ecl+(i<nShort?0:1));k+=d.length;const e=rsRemainder(d,div);if(i<nShort)d.push(0);blocks.push([...d,...e]);}
 const all:number[]=[];for(let i=0;i<blocks[0].length;i++)blocks.forEach((b,j)=>{if(i!==shortLen-ecl||j>=nShort)all.push(b[i]);});
 const size=ver*4+17;const m:boolean[][]=Array.from({length:size},()=>new Array(size).fill(false));
 const fn:boolean[][]=Array.from({length:size},()=>new Array(size).fill(false));
 const set=(x:number,y:number,dark:boolean)=>{m[y][x]=dark;fn[y][x]=true;};
 for(let i=0;i<size;i++){set(6,i,i%2===0);set(i,6,i%2===0);}
 const finder=(cx:number,cy:number)=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy)),x=cx+dx,y=cy+dy;if(x>=0&&x<size&&y>=0&&y<size)set(x,y,d!==2&&d!==4);}};
 finder(3,3);finder(size-4,3);finder(3,size-4);
 const al=alignPositions(ver);
 for(let i=0;i<al.length;i++)for(let j=0;j<al.length;j++){if((i===0&&j===0)||(i===0&&j===al.length-1)||(i===al.length-1&&j===0))continue;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(al[i]+dx,al[j]+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);}
 const drawFormat=(mask:number)=>{const d=(0<<3)|mask;let r=d;for(let i=0;i<10;i++)r=(r<<1)^((r>>>9)*0x537);const b=((d<<10)|r)^0x5412;
  const g=(i:number)=>((b>>>i)&1)!==0;
  for(let i=0;i<=5;i++)set(8,i,g(i));set(8,7,g(6));set(8,8,g(7));set(7,8,g(8));for(let i=9;i<15;i++)set(14-i,8,g(i));
  for(let i=0;i<8;i++)set(size-1-i,8,g(i));for(let i=8;i<15;i++)set(8,size-15+i,g(i));set(8,size-8,true);};
 drawFormat(0);
 if(ver>=7){let r=ver;for(let i=0;i<12;i++)r=(r<<1)^((r>>>11)*0x1f25);const b=(ver<<12)|r;
  for(let i=0;i<18;i++){const bit=((b>>>i)&1)!==0,a=size-11+i%3,c=Math.floor(i/3);set(a,c,bit);set(c,a,bit);}}
 // Place data bits in the zigzag.
 let i=0;for(let right=size-1;right>=1;right-=2){if(right===6)right=5;
  for(let vert=0;vert<size;vert++)for(let j=0;j<2;j++){const x=right-j,up=((right+1)&2)===0,y=up?size-1-vert:vert;
   if(!fn[y][x]&&i<all.length*8){m[y][x]=((all[i>>>3]>>>(7-(i&7)))&1)!==0;i++;}}}
 const maskFn=(k:number,x:number,y:number)=>[(x+y)%2,y%2,x%3,(x+y)%3,(Math.floor(x/3)+Math.floor(y/2))%2,x*y%2+x*y%3,(x*y%2+x*y%3)%2,((x+y)%2+x*y%3)%2][k]===0;
 const applyMask=(k:number)=>{for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!fn[y][x]&&maskFn(k,x,y))m[y][x]=!m[y][x];};
 const penalty=()=>{let p=0;
  const runs=(get:(a:number,b:number)=>boolean)=>{for(let a=0;a<size;a++){let run=1;for(let b=1;b<=size;b++){if(b<size&&get(a,b)===get(a,b-1))run++;else{if(run>=5)p+=run-2;run=1;}}}};
  runs((a,b)=>m[a][b]);runs((a,b)=>m[b][a]);
  for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++){const c=m[y][x];if(c===m[y][x+1]&&c===m[y+1][x]&&c===m[y+1][x+1])p+=3;}
  const pat=[true,false,true,true,true,false,true];
  const has=(get:(k:number)=>boolean,start:number)=>pat.every((v,k)=>get(start+k)===v);
  for(let a=0;a<size;a++)for(let b=0;b+7<=size;b++){
   for(const get of [(k:number)=>m[a][k],(k:number)=>m[k][a]]){if(has(get,b)){const light=(s:number,e:number)=>{for(let k=s;k<e;k++)if(k>=0&&k<size&&get(k))return false;return true;};if(light(b-4,b)||light(b+7,b+11))p+=40;}}}
  let dark=0;for(const row of m)for(const c of row)if(c)dark++;p+=Math.floor(Math.abs(dark*20-size*size*10)/(size*size))*10;return p;};
 let best=0,bestP=Infinity;
 for(let k=0;k<8;k++){applyMask(k);drawFormat(k);const p=penalty();if(p<bestP){bestP=p;best=k;}applyMask(k);}
 applyMask(best);drawFormat(best);
 return m;
}
/** SVG path data ("M x y h1 v1 h-1 z" per dark module) with a 4-module quiet zone. */
export function qrSvgPath(text:string):{size:number;path:string}{
 const m=qrMatrix(text),q=4;let path='';
 m.forEach((row,y)=>row.forEach((dark,x)=>{if(dark)path+=`M${x+q} ${y+q}h1v1h-1z`;}));
 return {size:m.length+q*2,path};
}
