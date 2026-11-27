import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {query,transaction} from '../../lib/db.js';
import {handler,HttpError} from '../../lib/errors.js';
import {decryptSecret,encryptSecret} from '../../lib/security.js';
import {requireAdmin,roles,type AdminIdentity} from '../auth/auth.js';
import {buildAuthorizeUrl,hashState,newState,STATE_TTL_MS,parseTikTokInput,parseTokenResponse,verifyAuthorizedAccount,missingScopes,DEFAULT_SCOPES} from './core.mjs';
import {exchangeCode,revokeToken,userInfo} from './client.js';
import {tiktokSettings} from './settings.js';
import {claimOAuthState,finishOAuthState} from './oauth-state.js';
import {config} from '../../lib/config.js';

export const tiktokOAuthRoutes=Router();
tiktokOAuthRoutes.use('/tiktok/oauth',requireAdmin,roles('owner','editor'));
const settings=()=>{const s=tiktokSettings();if(!s.configured||missingScopes(s.scopes,DEFAULT_SCOPES).length||s.scopes.some(x=>!DEFAULT_SCOPES.includes(x))||s.redirectUri!==new URL('/tiktok/callback',config.ADMIN_ORIGIN).toString())throw new HttpError(409,'TIKTOK_NOT_CONFIGURED','Configure the four TikTok scopes and the registered Admin callback on Module 1.');return s;};
const startBody=z.object({personId:z.string().uuid(),handle:z.string().max(200)}).strict();
const exchangeBody=z.object({code:z.string().min(4).max(1024),state:z.string().min(32).max(128)}).strict();
tiktokOAuthRoutes.post('/tiktok/oauth/start',handler(async(req,res)=>{
 const s=settings(),admin=res.locals.admin as AdminIdentity,b=startBody.parse(req.body),parsed=parseTikTokInput(b.handle);
 if(!parsed.ok)throw new HttpError(400,'TIKTOK_HANDLE','Enter the TikTok username.');
 const state=newState(),authorizeUrl=buildAuthorizeUrl({clientKey:s.clientKey,redirectUri:s.redirectUri,scopes:s.scopes,state});
 await transaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(710324)');
  if(!(await c.query('SELECT id FROM people WHERE id=$1 FOR UPDATE',[b.personId])).rowCount)throw new HttpError(404,'NOT_FOUND','Person not found.');
  const existing=(await c.query(`SELECT a.person_id, a.handle, t.account_id AS connection FROM accounts a
   LEFT JOIN tiktokingest.connections t ON t.account_id=a.id
   WHERE a.platform='tiktok' AND (a.person_id=$1 OR lower(ltrim(a.handle,'@'))=$2)`,[b.personId,parsed.value])).rows;
  if(existing.some(r=>r.person_id!==b.personId||String(r.handle).replace(/^@/,'').toLowerCase()!==parsed.value))throw new HttpError(409,'TIKTOK_EXISTS','This creator or username is already linked to a different account.');
  if(existing.some(r=>r.connection))throw new HttpError(409,'TIKTOK_CONNECTED','Disconnect the existing authorization before connecting again.');
  await c.query('DELETE FROM tiktokingest.oauth_states WHERE expires_at<now()');
  if((await c.query('SELECT 1 FROM tiktokingest.oauth_states WHERE (person_id=$1 OR expected_username=$2) AND expires_at>now()',[b.personId,parsed.value])).rowCount)throw new HttpError(409,'TIKTOK_PENDING','A sign-in is already pending. Retry after ten minutes.');
  await c.query('INSERT INTO tiktokingest.oauth_states(state_hash,admin_id,person_id,expected_username,expires_at) VALUES($1,$2,$3,$4,$5)',[hashState(state),admin.id,b.personId,parsed.value,new Date(Date.now()+STATE_TTL_MS).toISOString()]);
  await c.query("INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,'tiktok.oauth.start',$2,'{}'::jsonb)",[admin.id,b.personId]);
 });
 res.set('Cache-Control','no-store').json({data:{authorizeUrl}});
}));
tiktokOAuthRoutes.post('/tiktok/oauth/exchange',handler(async(req,res)=>{
 const s=settings(),admin=res.locals.admin as AdminIdentity,b=exchangeBody.parse(req.body);
 // Atomic single-use claim. A different admin cannot consume the state. No lock during network calls.
 const st=await claimOAuthState(b.state,admin.id);
 if(!st)throw new HttpError(400,'TIKTOK_STATE','Sign-in expired or already used. Start again.');
 try{
  const raw=await exchangeCode(s,b.code).catch(()=>null);
  if(!raw||raw.status>=400)throw new HttpError(502,'TIKTOK_EXCHANGE','TikTok sign-in failed. Start again.');
  const token=parseTokenResponse(raw.body,Date.now());
  if(!token.ok)throw new HttpError(400,'TIKTOK_EXCHANGE','TikTok did not return a usable authorization.');
  try{
   if(missingScopes(token.scopes,DEFAULT_SCOPES).length)throw new HttpError(400,'TIKTOK_SCOPES','Grant all four requested permissions.');
   const info=await userInfo(token.accessToken,token.scopes).catch(()=>null);
   const verified=verifyAuthorizedAccount({expectedUsername:st.expected_username,expectedOpenId:token.openId,grantedScopes:token.scopes,body:info?.body,httpStatus:info?.status??503});
   if(!verified.ok){
    if(verified.reason==='provider_unavailable')throw new HttpError(502,'TIKTOK_UNREACHABLE','TikTok identity could not be verified. Start again.');
    if(verified.reason==='username_unavailable')throw new HttpError(400,'TIKTOK_USERNAME','TikTok did not return the username. Grant profile access and try again.');
    throw new HttpError(409,'TIKTOK_IDENTITY','The authorized TikTok username does not match the selected creator.');
   }
   await transaction(async c=>{
    await c.query('SELECT pg_advisory_xact_lock(710324)');
    if(!(await c.query('SELECT id FROM people WHERE id=$1 FOR UPDATE',[st.person_id])).rowCount)throw new HttpError(404,'NOT_FOUND','Person was removed.');
    if(!(await c.query('SELECT 1 FROM tiktokingest.oauth_states WHERE state_hash=$1 AND admin_id=$2 AND used_at IS NOT NULL AND expires_at>now()',[hashState(b.state),admin.id])).rowCount)throw new HttpError(400,'TIKTOK_STATE','Sign-in expired. Start again.');
    const linked=(await c.query<{id:string;external_id:string}>("SELECT id,external_id FROM accounts WHERE person_id=$1 AND platform='tiktok'",[st.person_id])).rows[0];
    if(linked&&linked.external_id!==token.openId)throw new HttpError(409,'TIKTOK_IDENTITY','This authorization does not match the previously linked TikTok account.');
    const account=linked??(await c.query<{id:string}>("INSERT INTO accounts(person_id,platform,external_id,handle) VALUES($1,'tiktok',$2,$3) RETURNING id",[st.person_id,token.openId,'@'+st.expected_username])).rows[0];
    await c.query(`INSERT INTO tiktokingest.connections(account_id,open_id,username,scopes,access_token_enc,refresh_token_enc,access_expires_at,refresh_expires_at,connected_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[account.id,token.openId,st.expected_username,token.scopes,encryptSecret(token.accessToken),encryptSecret(token.refreshToken),token.accessExpiresAt,token.refreshExpiresAt,admin.id]);
    await c.query("INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,'tiktok.connect',$2,'{}'::jsonb)",[admin.id,account.id]);
   });
  }catch(e){
   // Avoid revoking a pre-existing connection if someone authorized an already-linked open_id.
   const prior=await query('SELECT 1 FROM tiktokingest.connections WHERE open_id=$1',[token.openId]).catch(()=>null);
   if(prior&&prior.rowCount===0){try{await revokeToken(s,token.accessToken);}catch{/* best effort */}}
   if(e instanceof HttpError)throw e;
   // Do not propagate SQL diagnostics containing credential ciphertext.
   throw new HttpError(409,'TIKTOK_SAVE','Connection could not be saved. Check for an existing account and retry.');
  }
  res.set('Cache-Control','no-store').json({data:{connected:true,handle:'@'+st.expected_username}});
 }finally{await finishOAuthState(b.state,admin.id).catch(()=>{/* expires naturally */});}
}));

const id=z.string().uuid();
// Disconnect is explicit; retain the registry identity and any later Hub history.
// Claim before network I/O, with a timed retry for a crash. No automatic refresh in this increment.
tiktokOAuthRoutes.post('/tiktok/oauth/disconnect/:id',handler(async(req,res)=>{
 const accountId=id.parse(req.params.id),admin=res.locals.admin as AdminIdentity;
 const s=tiktokSettings(),claim=randomUUID();
 const claimed=(await query<{access_token_enc:string}>(`UPDATE tiktokingest.connections SET status='revoking',revocation_started_at=now(),revocation_claim=$2
 WHERE account_id=$1 AND (status='active' OR (status='revoking' AND revocation_started_at<now()-interval '2 minutes'))
 RETURNING access_token_enc`,[accountId,claim])).rows[0];
 if(!claimed)throw new HttpError(409,'TIKTOK_NOT_CONNECTED','No active authorization, or disconnection is already in progress.');
 let revoked=false;
 if(s.configured){try{const result=await revokeToken(s,decryptSecret(claimed.access_token_enc));revoked=result.status>=200&&result.status<300&&(!result.body||typeof result.body==='object'&&!('error' in result.body));}catch{/* local disconnect must still succeed */}}
 // Remove credentials even if upstream revoke fails. Creator can revoke via TikTok settings.
 await transaction(async c=>{
  if(!(await c.query("DELETE FROM tiktokingest.connections WHERE account_id=$1 AND status='revoking' AND revocation_claim=$2",[accountId,claim])).rowCount)throw new HttpError(409,'TIKTOK_DISCONNECT_CHANGED','Connection changed. Reload People.');
  await c.query("INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,'tiktok.disconnect',$2,$3::jsonb)",[admin.id,accountId,JSON.stringify({revoked})]);
 });
 res.set('Cache-Control','no-store').json({data:{disconnected:true,revoked}});
}));
