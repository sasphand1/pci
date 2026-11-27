import {DEFAULT_SCOPES,parseScopes,validRedirectUri} from './core.mjs';
/** Server-only settings. TikTok credentials never reach the public website, logs or API responses. */
export type TiktokSettings={clientKey:string;clientSecret:string;redirectUri:string;scopes:string[];configured:boolean};
export function tiktokSettings(env:NodeJS.ProcessEnv=process.env):TiktokSettings{
 const clientKey=(env.TIKTOK_CLIENT_KEY??'').trim(),clientSecret=(env.TIKTOK_CLIENT_SECRET??'').trim();
 const admin=(env.ADMIN_ORIGIN??'').replace(/\/+$/,'');
 const redirectUri=(env.TIKTOK_REDIRECT_URI??'').trim()||(admin?`${admin}/tiktok/callback`:'');
 const scopes=env.TIKTOK_SCOPES?parseScopes(env.TIKTOK_SCOPES):[...DEFAULT_SCOPES];
 return {clientKey,clientSecret,redirectUri,scopes,configured:Boolean(clientKey&&clientSecret&&validRedirectUri(redirectUri))};
}
