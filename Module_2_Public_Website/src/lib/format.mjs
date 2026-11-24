// Pure functions: no dependencies, and separately testable with Node.
export function formatCount(input,compact=false){
  if(input===null||input===undefined||input==='')return 'Unavailable';
  const s=String(input);
  if(!/^-?\d+$/.test(s))return 'Unavailable';
  const n=BigInt(s),negative=n<0n,abs=negative?-n:n;
  if(!compact||abs<1000n)return n.toLocaleString('en-US');
  const units=[[1000000000000n,'T'],[1000000000n,'B'],[1000000n,'M'],[1000n,'K']];
  for(let i=0;i<units.length;i++){const [div,suffix]=units[i];if(abs>=div){let scaled=(abs*10n+div/2n)/div;let unit=suffix;if(scaled>=10000n&&i>0){const [bigger,biggerSuffix]=units[i-1];scaled=(abs*10n+bigger/2n)/bigger;unit=biggerSuffix;}const whole=scaled/10n,part=scaled%10n;return `${negative?'-':''}${whole}${part?'.'+part:''}${unit}`;}}
  return n.toLocaleString('en-US');
}
export function safeYoutubeImage(url){
  if(typeof url!=='string')return null;
  try {const u=new URL(url);const allow=new Set(['i.ytimg.com','img.youtube.com','yt3.googleusercontent.com','yt3.ggpht.com','ytimg.com']);
    return u.protocol==='https:'&&allow.has(u.hostname)?u.toString():null;
  }catch{return null;}
}
// Profile avatars can come from YouTube or Meta Business Discovery.
// Keep video thumbnails restricted to safeYoutubeImage.
export function safeCreatorImage(url){
  if(typeof url!=='string'||url.length>4096)return null;
  try{
    const u=new URL(url);
    const host=u.hostname.toLowerCase();
    const meta=host.endsWith('.cdninstagram.com')||host.endsWith('.fbcdn.net');
    const cached=/^\/api\/v1\/public\/avatars\/[0-9a-fA-F-]{36}$/.test(u.pathname);
    return u.protocol==='https:'&&!u.username&&!u.password&&(meta||cached||safeYoutubeImage(url)!==null)?u.toString():null;
  }catch{return null;}
}
export function safeVideoId(s){return typeof s==='string'&&/^[A-Za-z0-9_-]{11}$/.test(s)?s:null;}
export function safeChannelId(s){return typeof s==='string'&&/^UC[A-Za-z0-9_-]{22}$/.test(s)?s:null;}
export function displayDate(value){if(!value)return 'Not available';const t=new Date(value);return Number.isFinite(t.valueOf())?t.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):'Not available';}
export function isStale(value,hours=36){if(!value)return true;const time=new Date(value).valueOf();return !Number.isFinite(time)||Date.now()-time>hours*3600000;}

export function displayTime(value){if(!value)return '';const d=new Date(value);return Number.isFinite(d.valueOf())?d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Karachi'})+' PKT':'';}
