// Satify free connectors: URLs and pure parsers (no network here, so they are unit-testable).
// Every parser returns readings: {signal, scope, value, text, badge, source, observedAt}.
import {AIRPORTS} from './catalog.mjs';

const num=v=>{const n=typeof v==='string'?Number(v):v;return typeof n==='number'&&Number.isFinite(n)?n:null;};
const iso=ms=>new Date(ms).toISOString();
export const TROY_OZ_G=31.1034768,TOLA_G=11.6638038;

// ---------- METAR: aviationweather.gov (US public domain) ----------
export function metarUrl(){return `https://aviationweather.gov/api/data/metar?ids=${Object.values(AIRPORTS).join(',')}&format=json&hours=3`;}
/** Visibility in km from a raw METAR: 4-digit metres group (9999 = 10 km or more), CAVOK, or statute miles. */
export function metarVisibilityKm(raw,visibField){
 if(typeof raw==='string'){
  const tokens=raw.trim().split(/\s+/);
  if(tokens.includes('CAVOK'))return 10;
  const wind=tokens.findIndex(t=>/^(\d{3}|VRB)\d{2,3}(G\d{2,3})?(KT|MPS)$/.test(t));
  for(let i=wind<0?0:wind+1;i<tokens.length;i++){
   const t=tokens[i];
   if(/^\d{3}V\d{3}$/.test(t))continue;
   if(/^\d{4}$/.test(t))return t==='9999'?10:Math.round(Number(t)/100)/10;
   const sm=/^(\d{1,2})SM$/.exec(t);if(sm)return Math.round(Number(sm[1])*16.09)/10;
   if(/^(M?\d\/\d)SM$/.test(t))return 0.8;
   if(/^(FEW|SCT|BKN|OVC|SKC|NSC|NCD|VV)/.test(t))break;
  }
 }
 if(typeof visibField==='string'&&visibField.endsWith('+'))return 10;
 const miles=num(visibField);return miles===null?null:Math.round(Math.min(miles*1.609,10)*10)/10;
}
export function parseMetar(body){
 if(!Array.isArray(body))throw Error('Malformed METAR response');
 const latest=new Map();
 for(const m of body){
  const icao=typeof m?.icaoId==='string'?m.icaoId:null;if(!icao)continue;
  const at=num(m.obsTime)!==null?num(m.obsTime)*1000:Date.parse(m.reportTime??'');
  if(!Number.isFinite(at))continue;
  const prev=latest.get(icao);if(!prev||prev.at<at)latest.set(icao,{at,m});
 }
 const out=[];
 for(const [city,icao] of Object.entries(AIRPORTS)){
  const hit=latest.get(icao);if(!hit)continue;
  const vis=metarVisibilityKm(hit.m.rawOb,hit.m.visib);
  if(vis!==null)out.push({signal:'visibility_km',scope:city,value:vis,text:typeof hit.m.wxString==='string'?hit.m.wxString.slice(0,40):null,badge:'measured',source:`METAR ${icao}`,observedAt:iso(hit.at)});
 }
 if(!out.length)throw Error('METAR response without Pakistan stations');
 return out;
}

// ---------- Dollar rate ----------
export const FX_SBP_URL='https://api.frankfurter.dev/v2/rate/usd/pkr?providers=sbp';
export const FX_ERAPI_URL='https://open.er-api.com/v6/latest/USD';
const plausibleUsdPkr=v=>v!==null&&v>100&&v<1000;
export function parseFrankfurter(body,now=Date.now()){
 const rate=num(body?.rate)??num(body?.rates?.PKR)??num(Array.isArray(body)?body[0]?.rate:null);
 if(!plausibleUsdPkr(rate))throw Error('Frankfurter response without a plausible USD/PKR rate');
 const d=Date.parse(body?.date??(Array.isArray(body)?body[0]?.date:'')??'');
 return [{signal:'usd_pkr',scope:'pk',value:Math.round(rate*100)/100,text:null,badge:'official',source:'State Bank of Pakistan (via Frankfurter)',observedAt:iso(Number.isFinite(d)?d:now)}];
}
export function parseErApi(body,now=Date.now()){
 if(body?.result!=='success')throw Error('open.er-api response not successful');
 const rate=num(body?.rates?.PKR);if(!plausibleUsdPkr(rate))throw Error('open.er-api response without a plausible PKR rate');
 const t=num(body?.time_last_update_unix);
 return [{signal:'usd_pkr',scope:'pk',value:Math.round(rate*100)/100,text:null,badge:'measured',source:'Rates by Exchange Rate API (open.er-api.com)',observedAt:iso(t!==null?t*1000:now)}];
}

// ---------- Gold: xaus.com spot (free, cache ≥ 60 s) ----------
export const GOLD_XAUS_URL='https://xaus.com/api/v1/spot?currency=PKR';
export function parseXaus(body,now=Date.now()){
 const usdOz=num(body?.spot_usd_oz),pkrOz=num(body?.xau?.price);
 if(usdOz===null||usdOz<500||usdOz>50000)throw Error('xaus response without a plausible gold price');
 const at=Date.parse(body?.price_as_of??body?.updated_at??'');const observedAt=iso(Number.isFinite(at)?at:now);
 const out=[{signal:'gold_usd_oz',scope:'pk',value:Math.round(usdOz*100)/100,text:null,badge:'measured',source:'xaus.com spot',observedAt}];
 if(pkrOz!==null&&String(body?.xau?.currency??'').toUpperCase()==='PKR'&&pkrOz>usdOz*100)
  out.push({signal:'gold_tola',scope:'pk',value:Math.round(pkrOz/TROY_OZ_G*TOLA_G),text:'spot-based estimate',badge:'estimate',source:'xaus.com spot × dollar rate (24k, before local premium)',observedAt});
 return out;
}
