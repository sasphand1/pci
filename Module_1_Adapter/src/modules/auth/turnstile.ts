import { config } from '../../lib/config.js';
import { HttpError } from '../../lib/errors.js';
export async function verifyTurnstile(token?:string,ip?:string){
  if(config.NODE_ENV!=='production' && config.DEV_BYPASS_TURNSTILE==='true')return;
  if(!config.TURNSTILE_SECRET_KEY||!token||token.length>2048)throw new HttpError(400,'BOT_CHECK_REQUIRED','Bot verification required');
  const body=new URLSearchParams({secret:config.TURNSTILE_SECRET_KEY,response:token});if(ip)body.set('remoteip',ip);
  let result: any;
  try {const res=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(8000)});result=await res.json();}
  catch{throw new HttpError(503,'BOT_CHECK_UNAVAILABLE','Bot verification unavailable');}
  if(!result?.success || (config.TURNSTILE_EXPECTED_HOSTNAME && result.hostname!==config.TURNSTILE_EXPECTED_HOSTNAME))throw new HttpError(403,'BOT_CHECK_FAILED','Bot verification failed');
}
