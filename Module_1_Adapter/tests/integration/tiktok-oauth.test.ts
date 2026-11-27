// Requires a migrated disposable *_test PostgreSQL database and Redis; TikTok HTTP is mocked.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import {pool,query} from '../../src/lib/db.js';
import {redis,ensureRedis} from '../../src/lib/redis.js';
import {config} from '../../src/lib/config.js';
import {decryptSecret,sha256} from '../../src/lib/security.js';
import {ensureRegistrySchema} from '../../src/lib/registry-schema.js';
import {ensureTikTokSchema} from '../../src/lib/tiktok-schema.js';
import {errorMiddleware} from '../../src/lib/errors.js';
import {tiktokOAuthRoutes} from '../../src/modules/tiktok/oauth.js';
import {hashState,DEFAULT_SCOPES} from '../../src/modules/tiktok/core.mjs';
if(process.env.NODE_ENV!=='test'||!/\/_?[^/]*_test(?:\?|$)/.test(process.env.DATABASE_URL??''))throw new Error('Use a disposable *_test database');
const app=express();app.use(express.json());app.use(cookieParser());app.use('/api/v1/admin',tiktokOAuthRoutes);app.use(errorMiddleware);
type Session={id:string;token:string;csrf:string};
const sessions:Session[]=[],persons:string[]=[];
let editor:Session,other:Session,moderator:Session;
const prefix='/api/v1/admin/tiktok/oauth';
const originalFetch=globalThis.fetch;
const mock=new Map<string,{username:string;openId:string;scopes:string[]}>();
let revocations=0,failRevoke=false;
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
function grant(username:string,openId='open-'+randomUUID(),scopes=[...DEFAULT_SCOPES]){const code=randomUUID();mock.set(code,{username,openId,scopes});return {code,openId};}
async function session(role:'editor'|'moderator'):Promise<Session>{
 const email=`tiktok-test-${randomUUID()}@example.invalid`;
 const row=(await query<{id:string;session_version:number}>("INSERT INTO admin_users(email,password_hash,role,totp_secret_enc) VALUES($1,'test',$2,'test') RETURNING id,session_version",[email,role])).rows[0];
 const s={id:row.id,token:randomUUID(),csrf:randomUUID()};sessions.push(s);
 await redis.set('admin:session:'+sha256(s.token),JSON.stringify({id:s.id,email,role,csrf:s.csrf,version:row.session_version,exp:Math.floor(Date.now()/1000)+3600}),'EX',3600);return s;
}
async function person(){const slug='tt-test-'+randomUUID();const id=(await query<{id:string}>("INSERT INTO people(slug,display_name) VALUES($1,'TikTok Test') RETURNING id",[slug])).rows[0].id;persons.push(id);return id;}
const post=(path:string,s:Session)=>request(app).post(prefix+path).set('Cookie','pci_admin='+s.token).set('X-CSRF-Token',s.csrf);
const start=async(personId:string,handle:string,s=editor)=>{const res=await post('/start',s).send({personId,handle}).expect(200);const url=new URL(res.body.data.authorizeUrl);assert.equal(url.origin,'https://www.tiktok.com');return url.searchParams.get('state')!;};
const account=async(personId:string)=>(await query<{id:string;external_id:string}>("SELECT id,external_id FROM accounts WHERE platform='tiktok' AND person_id=$1",[personId])).rows[0];
test.before(async()=>{
 await ensureRegistrySchema();await ensureTikTokSchema();await ensureTikTokSchema();await ensureRedis();
 config.ADMIN_ORIGIN='https://admin.example.invalid';process.env.TIKTOK_CLIENT_KEY='testkey123';process.env.TIKTOK_CLIENT_SECRET='testsecret';process.env.TIKTOK_REDIRECT_URI=config.ADMIN_ORIGIN+'/tiktok/callback';process.env.TIKTOK_SCOPES=DEFAULT_SCOPES.join(',');
 editor=await session('editor');other=await session('editor');moderator=await session('moderator');
 globalThis.fetch=async(input,init)=>{
  const u=new URL(String(input));assert.equal(u.hostname,'open.tiktokapis.com');
  if(u.pathname==='/v2/oauth/token/'){
   const form=new URLSearchParams(String(init?.body));const code=form.get('code')??'';const item=mock.get(code);if(!item)return json({error:'invalid_grant'},400);
   return json({open_id:item.openId,access_token:'access:'+code,refresh_token:'refresh:'+code,scope:item.scopes.join(','),expires_in:7200,refresh_expires_in:15552000});
  }
  if(u.pathname==='/v2/user/info/'){
   const code=(new Headers(init?.headers).get('Authorization')??'').replace('Bearer access:','');const item=mock.get(code);if(!item)return json({error:{code:'access_token_invalid'}},401);
   return json({data:{user:{open_id:item.openId,username:item.username,display_name:'Test',follower_count:17}},error:{code:'ok'}});
  }
  if(u.pathname==='/v2/oauth/revoke/'){revocations++;return failRevoke?json({error:'server_error'},503):new Response(null,{status:200});}
  throw new Error('Unexpected mock provider request');
 };
});
test.after(async()=>{
 globalThis.fetch=originalFetch;
 try{if(persons.length)await query('DELETE FROM people WHERE id=ANY($1::uuid[])',[persons]);
  if(sessions.length){await query('DELETE FROM admin_audit_logs WHERE actor_id=ANY($1::uuid[])',[sessions.map(x=>x.id)]);await query('DELETE FROM admin_users WHERE id=ANY($1::uuid[])',[sessions.map(x=>x.id)]);await redis.del(...sessions.map(x=>'admin:session:'+sha256(x.token)));}}
 finally{await pool.end();if(redis.status!=='end')await redis.quit();}
});
test('OAuth uses existing admin roles and CSRF, rejects unauthorized callers',async()=>{
 const p=await person(),body={personId:p,handle:'tt_guard'};
 await request(app).post(prefix+'/start').send(body).expect(401);
 await post('/start',moderator).send(body).expect(403);
 await request(app).post(prefix+'/start').set('Cookie','pci_admin='+editor.token).send(body).expect(403);
});
test('Start creates a hashed state, no dummy account; another admin cannot consume it',async()=>{
 const p=await person(),state=await start(p,'tt_state');
 assert.ok(!await account(p));const row=(await query('SELECT state_hash,used_at FROM tiktokingest.oauth_states WHERE person_id=$1',[p])).rows[0];assert.equal(row.state_hash,hashState(state));assert.equal(row.used_at,null);
 await post('/start',editor).send({personId:p,handle:'tt_state'}).expect(409);
 await post('/start',editor).send({personId:await person(),handle:'tt_state'}).expect(409);
 await post('/exchange',other).send({state,code:randomUUID()}).expect(400);
 assert.equal((await query('SELECT used_at FROM tiktokingest.oauth_states WHERE person_id=$1',[p])).rows[0].used_at,null);
 await query("UPDATE tiktokingest.oauth_states SET expires_at=now()-interval '1 second' WHERE person_id=$1",[p]);
 await post('/exchange',editor).send({state,code:randomUUID()}).expect(400);assert.ok(!await account(p));
});
test('Concurrent exchange consumes state once and stores encrypted, correctly attributed tokens',async()=>{
 const p=await person(),state=await start(p,'tt_verified'),g=grant('tt_verified');
 const results=await Promise.all([post('/exchange',editor).send({state,code:g.code}),post('/exchange',editor).send({state,code:g.code})]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);assert.ok(!JSON.stringify(results.map(r=>r.body)).includes('access:'+g.code));
 const a=await account(p);assert.equal(a.external_id,g.openId);
 const row=(await query('SELECT * FROM tiktokingest.connections WHERE account_id=$1',[a.id])).rows[0];assert.equal(row.status,'active');assert.notEqual(row.access_token_enc,'access:'+g.code);assert.equal(decryptSecret(row.access_token_enc),'access:'+g.code);assert.equal(decryptSecret(row.refresh_token_enc),'refresh:'+g.code);
 await post('/exchange',editor).send({state,code:g.code}).expect(400);
 await post('/start',editor).send({personId:p,handle:'tt_verified'}).expect(409);
 await post('/start',editor).send({personId:await person(),handle:'TT_VERIFIED'}).expect(409);
});
test('Wrong username and missing scopes are rejected, revoked and never registered',async()=>{
 const p=await person(),before=revocations;
 const st=await start(p,'tt_expected'),wrong=grant('tt_other');await post('/exchange',editor).send({state:st,code:wrong.code}).expect(409);assert.ok(!await account(p));
 const st2=await start(p,'tt_expected'),partial=grant('tt_expected',undefined,['user.info.basic']);await post('/exchange',editor).send({state:st2,code:partial.code}).expect(400);
 assert.equal(revocations,before+2);assert.ok(!await account(p));
});
test('Disconnect revokes upstream, removes tokens and retains verified identity for reconnection',async()=>{
 const p=await person(),st=await start(p,'tt_disconnect'),g=grant('tt_disconnect');await post('/exchange',editor).send({state:st,code:g.code}).expect(200);
 const a=await account(p),before=revocations;const res=await post('/disconnect/'+a.id,editor).send({}).expect(200);assert.equal(res.body.data.revoked,true);assert.equal(revocations,before+1);
 assert.equal((await query('SELECT 1 FROM tiktokingest.connections WHERE account_id=$1',[a.id])).rowCount,0);assert.equal((await account(p)).id,a.id);
 const st2=await start(p,'tt_disconnect'),g2=grant('tt_disconnect',g.openId);await post('/exchange',editor).send({state:st2,code:g2.code}).expect(200);assert.equal((await account(p)).id,a.id);
});
test('Failed upstream revoke still removes PCI credentials, reports false; person deletion cascades',async()=>{
 const p=await person(),st=await start(p,'tt_revoke_fail'),g=grant('tt_revoke_fail');await post('/exchange',editor).send({state:st,code:g.code}).expect(200);
 const a=await account(p);failRevoke=true;try{const res=await post('/disconnect/'+a.id,editor).send({}).expect(200);assert.equal(res.body.data.revoked,false);}finally{failRevoke=false;}
 assert.equal((await query('SELECT 1 FROM tiktokingest.connections WHERE account_id=$1',[a.id])).rowCount,0);
 const st2=await start(p,'tt_revoke_fail'),g2=grant('tt_revoke_fail',g.openId);await post('/exchange',editor).send({state:st2,code:g2.code}).expect(200);
 await query('DELETE FROM people WHERE id=$1',[p]);assert.equal((await query('SELECT 1 FROM tiktokingest.connections WHERE account_id=$1',[a.id])).rowCount,0);assert.ok(!await account(p));
});
