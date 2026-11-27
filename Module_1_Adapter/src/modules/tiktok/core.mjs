// TikTok ingest core (tiktokingest). Pure rules: no database, network, clock or config access,
// so every rule is covered by fast native tests. Contracts follow the official TikTok for Developers docs:
// Login Kit for Web (authorize), OAuth v2 token/revoke, Display API v2 user/info and video/list.
import {createHash,randomBytes} from 'node:crypto';

export const AUTHORIZE_URL='https://www.tiktok.com/v2/auth/authorize/';
export const TOKEN_URL='https://open.tiktokapis.com/v2/oauth/token/';
export const REVOKE_URL='https://open.tiktokapis.com/v2/oauth/revoke/';
export const USER_INFO_URL='https://open.tiktokapis.com/v2/user/info/';
export const VIDEO_LIST_URL='https://open.tiktokapis.com/v2/video/list/';
export const DEFAULT_SCOPES=Object.freeze(['user.info.basic','user.info.profile','user.info.stats','video.list']);
/** Fields per scope (Display API v2 user object). */
export const USER_FIELDS=Object.freeze({
  'user.info.basic':['open_id','union_id','avatar_url','avatar_url_100','avatar_large_url','display_name'],
  'user.info.profile':['bio_description','profile_deep_link','is_verified','username'],
  'user.info.stats':['follower_count','following_count','likes_count','video_count']
});
/** Video object fields requested from video/list (Display API v2 video object). */
export const VIDEO_FIELDS=Object.freeze(['id','create_time','cover_image_url','share_url','video_description','duration','height','width','title','embed_link','like_count','comment_count','share_count','view_count']);
export const VIDEO_PAGE_MAX=20;            // documented maximum per request
export const VIDEO_SAMPLE_LIMIT=50;        // same latest-50 sample as YouTube
export const STATE_TTL_MS=10*60_000;
export const ACCESS_REFRESH_MARGIN_S=600;  // renew 10 minutes before the 2-hour access token expires
export const REFRESH_WARN_DAYS=14;         // warn admins before the 180-day refresh token lapses
const DAY=86_400_000;

export const TIKTOK_USERNAME=/^[a-z0-9._]{2,24}$/;

/** Accepts @name, name, or https://www.tiktok.com/@name[/...]. Lower-case result, never a URL. */
export function parseTikTokInput(input){
  const raw=String(input??'').trim();
  if(!raw)return {ok:false,status:'invalid_format',hint:'Empty input'};
  let name=raw;
  if(/^(https?:\/\/)?((www|m|vm)\.)?tiktok\.com\//i.test(raw)){
    let u;try{u=new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`);}catch{return {ok:false,status:'invalid_format',hint:'Not a valid link'};}
    const host=u.hostname.toLowerCase();
    if(!['tiktok.com','www.tiktok.com','m.tiktok.com','vm.tiktok.com'].includes(host)||u.username||u.password||u.port)return {ok:false,status:'invalid_format',hint:'Not a TikTok profile URL'};
    if(host==='vm.tiktok.com')return {ok:false,status:'invalid_format',hint:'Short vm.tiktok.com links cannot be checked. Use tiktok.com/@username'};
    const seg=u.pathname.split('/').filter(Boolean);
    if(!seg[0]?.startsWith('@'))return {ok:false,status:'invalid_format',hint:'Use the profile link tiktok.com/@username'};
    try{name=decodeURIComponent(seg[0]);}catch{return {ok:false,status:'invalid_format',hint:'Invalid URL encoding'};}
  }else if(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw))return {ok:false,status:'invalid_format',hint:'Not a tiktok.com link'};
  if(name.startsWith('@'))name=name.slice(1);
  name=name.toLowerCase();
  if(!TIKTOK_USERNAME.test(name))return {ok:false,status:'invalid_format',hint:'A TikTok username has 2-24 letters, digits, dots or underscores'};
  return {ok:true,kind:'username',value:name};
}
/** Placeholder id until the creator authorizes: replaced by the TikTok open_id at connection. */


// ---------- OAuth ----------
export const newState=()=>randomBytes(32).toString('base64url');
export const hashState=state=>createHash('sha256').update(String(state)).digest('hex');
export function validRedirectUri(uri){
  try{const u=new URL(uri);return u.protocol==='https:'&&!u.search&&!u.hash&&uri.length<512&&!u.username&&!u.password;}catch{return false;}
}
/** Web Login Kit: no PKCE (TikTok uses PKCE only for desktop and mobile). */
export function buildAuthorizeUrl({clientKey,redirectUri,scopes=DEFAULT_SCOPES,state}){
  if(!clientKey||!/^[A-Za-z0-9]{4,64}$/.test(clientKey))throw new Error('TIKTOK_CLIENT_KEY_INVALID');
  if(!validRedirectUri(redirectUri))throw new Error('TIKTOK_REDIRECT_URI_INVALID');
  if(!state||state.length<32)throw new Error('TIKTOK_STATE_WEAK');
  const u=new URL(AUTHORIZE_URL);
  u.searchParams.set('client_key',clientKey);
  u.searchParams.set('scope',[...new Set(scopes)].join(','));
  u.searchParams.set('response_type','code');
  u.searchParams.set('redirect_uri',redirectUri);
  u.searchParams.set('state',state);
  return u.toString();
}
/** Single use, short-lived, bound to the admin who started it. */
export function stateDecision(row,{now,adminId}){
  if(!row)return 'unknown';
  if(row.used_at)return 'used';
  if(Date.parse(row.expires_at)<=now)return 'expired';
  if(row.admin_id!==adminId)return 'wrong_admin';
  return 'ok';
}
export const parseScopes=s=>String(s??'').split(/[,\s]+/).map(x=>x.trim()).filter(Boolean);
export const missingScopes=(granted,required=DEFAULT_SCOPES)=>required.filter(s=>!granted.includes(s));
/** Token endpoint response. Errors never echo token material. */
export function parseTokenResponse(body,nowMs){
  if(!body||typeof body!=='object')return {ok:false,error:'bad_response',description:'Token endpoint returned no JSON'};
  if(body.error&&!body.access_token)return {ok:false,error:/^[a-z_]{1,60}$/.test(String(body.error))?String(body.error):'token_error',description:'Token endpoint rejected the request'};
  const exp=Number(body.expires_in),rexp=Number(body.refresh_expires_in);
  if(typeof body.access_token!=='string'||!body.access_token||typeof body.refresh_token!=='string'||!body.refresh_token||typeof body.open_id!=='string'||!body.open_id||!Number.isSafeInteger(exp)||!Number.isSafeInteger(rexp)||exp<=0||rexp<=0||exp>86400||rexp>366*86400)
    return {ok:false,error:'bad_response',description:'Token response is missing required fields'};
  return {ok:true,accessToken:body.access_token,refreshToken:body.refresh_token,openId:body.open_id,scopes:parseScopes(body.scope),
    accessExpiresAt:new Date(nowMs+exp*1000).toISOString(),refreshExpiresAt:new Date(nowMs+rexp*1000).toISOString()};
}
export const accessNeedsRefresh=(accessExpiresAt,nowMs,marginS=ACCESS_REFRESH_MARGIN_S)=>!accessExpiresAt||Date.parse(accessExpiresAt)-nowMs<=marginS*1000;
export const refreshUsable=(refreshExpiresAt,nowMs)=>Boolean(refreshExpiresAt)&&Date.parse(refreshExpiresAt)>nowMs+60_000;

// ---------- numbers ----------
/** Exact non-negative integer or null. Values above 2^53-1 are refused rather than rounded (never fabricated). */
export function toCount(v){
  if(typeof v==='number')return Number.isSafeInteger(v)&&v>=0?v:null;
  if(typeof v==='string'&&/^\d{1,16}$/.test(v)){const n=Number(v);return Number.isSafeInteger(n)?n:null;}
  return null;
}
const httpsUrl=v=>{if(typeof v!=='string'||v.length>2048)return null;try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.toString():null;}catch{return null;}};
const text=(v,max)=>typeof v==='string'&&v.length?v.slice(0,max):null;

// ---------- Display API mapping ----------
/** TikTok error object → PCI outcome. */
export function classifyTikTokError(httpStatus,body){
  const code=String(body?.error?.code??body?.error??'');
  if(httpStatus===429||code==='rate_limit_exceeded')return {outcome:'rate_limited',detail:'rate_limit_exceeded'};
  if(code==='access_token_invalid'||code==='invalid_token'||httpStatus===401)return {outcome:'error',detail:'access_token_invalid'};
  if(code==='scope_not_authorized'||code==='scope_permission_missed')return {outcome:'unsupported',detail:'scope_not_authorized'};
  if(httpStatus>=500)return {outcome:'error',detail:`http_${httpStatus}`};
  return {outcome:'error',detail:'provider_error'};
}
const okEnvelope=body=>body&&typeof body==='object'&&(!body.error||body.error.code==='ok'||body.error.code===''||body.error.code===undefined);

/** user/info → identity, ranking metrics and extra hub metrics. Attribution: open_id must match the account. */
export function mapUserInfo(body,httpStatus,expectedOpenId){
  if(httpStatus>=400||!okEnvelope(body))return {...classifyTikTokError(httpStatus,body),metrics:[],extra:[]};
  const u=body?.data?.user;
  if(!u||typeof u!=='object')return {outcome:'error',detail:'no_user_object',metrics:[],extra:[]};
  if(typeof u.open_id!=='string'||!u.open_id)return {outcome:'error',detail:'open_id_missing',metrics:[],extra:[]};
  if(expectedOpenId&&u.open_id!==expectedOpenId)return {outcome:'error',detail:'open_id_mismatch',metrics:[],extra:[]};
  const identity={openId:u.open_id,unionId:text(u.union_id,128),username:typeof u.username==='string'&&TIKTOK_USERNAME.test(u.username.toLowerCase())?u.username.toLowerCase():null,
    displayName:text(u.display_name,150),bio:text(u.bio_description,500),isVerified:typeof u.is_verified==='boolean'?u.is_verified:null,
    profileUrl:httpsUrl(u.profile_deep_link),avatarUrl:httpsUrl(u.avatar_large_url)??httpsUrl(u.avatar_url_100)??httpsUrl(u.avatar_url)};
  const metrics=[],extra=[],notes=[];
  const followers=toCount(u.follower_count);
  if(followers!==null)metrics.push({metric:'followers',value:followers,accuracy:'exact'});else notes.push('followers_unavailable');
  for(const [field,metric] of [['following_count','following'],['likes_count','likes_total'],['video_count','video_count']]){
    const v=toCount(u[field]);if(v!==null)extra.push({metric,value:v,accuracy:'exact'});else notes.push(`${metric}_unavailable`);
  }
  if(!metrics.length&&!extra.length)return {outcome:'unsupported',detail:['stats_scope_missing',...notes].join(','),metrics,extra,identity};
  return {outcome:'ok',detail:notes.join(',')||undefined,metrics,extra,identity};
}
/** Authorization is accepted only for the expected identity and the four granted scopes.
 * A valid identity may have unavailable statistics; that never creates a fabricated metric. */
export function verifyAuthorizedAccount({expectedUsername,expectedOpenId,grantedScopes,body,httpStatus}){
  if(missingScopes(grantedScopes,DEFAULT_SCOPES).length)return {ok:false,reason:'missing_scopes'};
  const mapped=mapUserInfo(body,httpStatus,expectedOpenId);
  if(!mapped.identity)return {ok:false,reason:mapped.detail==='open_id_mismatch'?'identity_mismatch':'provider_unavailable'};
  if(!mapped.identity.username)return {ok:false,reason:'username_unavailable'};
  if(mapped.identity.username!==expectedUsername)return {ok:false,reason:'identity_mismatch'};
  return {ok:true,identity:mapped.identity};
}
/** One video object; a missing count stays null (never zero). */
export function mapVideo(v){
  if(!v||typeof v!=='object'||typeof v.id!=='string'||!/^\d{5,30}$/.test(v.id))return null;
  const t=toCount(v.create_time);
  const dur=toCount(v.duration),w=toCount(v.width),h=toCount(v.height);
  return {id:v.id,publishedAt:t!==null&&t<=253402300799?new Date(t*1000).toISOString():null,title:text(v.title,150),description:text(v.video_description,150),
    durationSec:dur,width:w,height:h,aspectRatio:w&&h?Math.round(w/h*1000)/1000:null,
    coverUrl:httpsUrl(v.cover_image_url),shareUrl:httpsUrl(v.share_url),embedLink:httpsUrl(v.embed_link),
    isAigc:typeof v.is_aigc==='boolean'?v.is_aigc:null,
    counts:{views:toCount(v.view_count),likes:toCount(v.like_count),comments:toCount(v.comment_count),shares:toCount(v.share_count)}};
}
export function mapVideoPage(body,httpStatus){
  if(httpStatus>=400||!okEnvelope(body))return {ok:false,...classifyTikTokError(httpStatus,body)};
  const d=body?.data??{};
  if(!Array.isArray(d.videos)||typeof d.has_more!=='boolean')return {ok:false,outcome:'error',detail:'invalid_video_page'};
  const raw=d.videos;
  const videos=[...new Map(raw.map(mapVideo).filter(Boolean).map(v=>[v.id,v])).values()];
  const cursor=toCount(d.cursor);
  if(d.has_more&&cursor===null)return {ok:false,outcome:'error',detail:'invalid_video_cursor'};
  return {ok:true,videos,cursor,hasMore:d.has_more===true,dropped:raw.length-videos.length};
}
/** Posts in the last 30 days from the newest-first sample. `complete` = the sample reached past the window. */
export function postsLast30(videos,nowMs,sampleComplete){
  let count=0,sawOlder=false;
  for(const v of new Map(videos.map(v=>[v.id,v])).values()){
    const t=v.publishedAt?Date.parse(v.publishedAt):NaN;
    if(!Number.isFinite(t)||t>nowMs)continue;
    if(nowMs-t<=30*DAY)count++;else sawOlder=true;
  }
  return {value:count,capped:!sawOlder&&!sampleComplete};
}
/** Deterministic PCI analytics over the sampled videos (no estimates, no composite scores). */
export function videoStats(videos,followers){
  const nums=k=>videos.map(v=>v.counts[k]).filter(x=>x!==null);
  const avg=a=>a.length?Math.round(a.reduce((s,x)=>s+x,0)/a.length):null;
  const views=nums('views').sort((a,b)=>a-b);
  const median=views.length?(views.length%2?views[(views.length-1)/2]:Math.round((views[views.length/2-1]+views[views.length/2])/2)):null;
  const both=videos.filter(v=>v.counts.views&&v.counts.likes!==null&&v.counts.comments!==null&&v.counts.shares!==null);
  const eng=both.length?both.reduce((s,v)=>s+(v.counts.likes+v.counts.comments+v.counts.shares)/v.counts.views,0)/both.length:null;
  const ratio=k=>{const r=videos.filter(v=>v.counts.views&&v.counts[k]!==null);return r.length?r.reduce((s,v)=>s+v.counts[k]/v.counts.views,0)/r.length:null;};
  const dated=videos.map(v=>v.publishedAt).filter(Boolean).sort();
  const best=[...videos].filter(v=>v.counts.views!==null).sort((a,b)=>b.counts.views-a.counts.views)[0]??null;
  const pct=x=>x===null?null:Math.round(x*10000)/100;
  return {sampled:videos.length,averageViews:avg(views),medianViews:median,averageLikes:avg(nums('likes')),averageComments:avg(nums('comments')),averageShares:avg(nums('shares')),
    engagementRateByViewsPct:pct(eng),likeToViewPct:pct(ratio('likes')),commentToViewPct:pct(ratio('comments')),shareToViewPct:pct(ratio('shares')),
    engagementRateByFollowersPct:followers&&avg(views)!==null&&both.length?pct(both.reduce((s,v)=>s+v.counts.likes+v.counts.comments+v.counts.shares,0)/both.length/followers):null,
    lastUploadAt:dated.at(-1)??null,bestVideoId:best?.id??null,
    sampleNote:'Sampled latest videos only; not lifetime account views.'};
}
