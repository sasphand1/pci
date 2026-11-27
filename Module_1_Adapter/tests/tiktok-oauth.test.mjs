import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_SCOPES,verifyAuthorizedAccount} from '../src/modules/tiktok/core.mjs';
const fields={open_id:'expected-id',username:'Creator.Name',display_name:'Creator'};
const input=(user=fields,overrides={})=>({expectedUsername:'creator.name',expectedOpenId:'expected-id',grantedScopes:[...DEFAULT_SCOPES],body:{data:{user},error:{code:'ok'}},httpStatus:200,...overrides});
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('OAuth allows only the verified account; missing statistics do not block identity or fabricate numbers',()=>{
 const r=verifyAuthorizedAccount(input());assert.equal(r.ok,true);assert.equal(r.identity.username,'creator.name');assert.equal(r.identity.openId,'expected-id');
 assert.equal(verifyAuthorizedAccount(input({...fields,username:'other'})).reason,'identity_mismatch');
 assert.equal(verifyAuthorizedAccount(input({...fields,open_id:'other-id'})).reason,'identity_mismatch');
 assert.equal(verifyAuthorizedAccount(input({...fields,username:null})).reason,'username_unavailable');
});
test('OAuth refuses missing scope or failed user-info response',()=>{
 assert.equal(verifyAuthorizedAccount(input(fields,{grantedScopes:['user.info.basic']})).reason,'missing_scopes');
 assert.equal(verifyAuthorizedAccount(input(fields,{body:{error:{code:'access_token_invalid'}},httpStatus:401})).reason,'provider_unavailable');
 assert.equal(verifyAuthorizedAccount(input(fields,{body:null,httpStatus:503})).reason,'provider_unavailable');
});
test('Migration 127 stores only authorization and extends the existing registry, with cascading identity deletion',()=>{
 const sql=read('../database/migrations/127_tiktok_oauth.sql');
 assert.match(sql,/platform IN \('youtube','instagram','tiktok'\)/);assert.match(sql,/accounts_tiktok_username_uq/);
 const tables=[...sql.matchAll(/CREATE TABLE IF NOT EXISTS ([\w.]+)/g)].map(x=>x[1]);assert.deepEqual(tables,['tiktokingest.connections','tiktokingest.oauth_states']);
 assert.match(sql,/REFERENCES accounts\(id\) ON DELETE CASCADE/);assert.match(sql,/REFERENCES people\(id\) ON DELETE CASCADE/);
 assert.doesNotMatch(sql,/CREATE.*(?:ingest_latest|metric_observations|refresh_runs)/);
});
test('Both startup paths apply the same additive migration without replacing old registry DDL',()=>{
 for(const path of ['../src/server.ts','../src/worker.ts']){const startup=read(path);assert.match(startup,/try\s*\{await ensureTikTokSchema\(\);/);assert.match(startup,/catch\(err\)\{logger.error\(\{err\},'TikTok OAuth schema unavailable/);}
 const source=read('../src/lib/tiktok-schema.ts');assert.match(source,/127_tiktok_oauth\.sql/);assert.match(source,/pg_advisory_xact_lock\(710323\)/);
});
test('State is atomically claimed, admin-bound, hashed and single-use',()=>{
 const source=read('../src/modules/tiktok/oauth-state.ts');assert.match(source,/UPDATE tiktokingest\.oauth_states SET used_at=now\(\)/);assert.match(source,/state_hash=\$1 AND admin_id=\$2 AND used_at IS NULL AND expires_at>now\(\)/);assert.match(source,/\[hashState\(state\),adminId\]/);assert.match(source,/DELETE FROM tiktokingest\.oauth_states/);
});
test('OAuth routes use PCI admin RBAC and encrypted credentials, not a second public API or collector',()=>{
 const source=read('../src/modules/tiktok/oauth.ts');assert.match(source,/requireAdmin,roles\('owner','editor'\)/);assert.match(source,/encryptSecret\(token\.accessToken\),encryptSecret\(token\.refreshToken\)/);assert.match(source,/claimOAuthState/);assert.match(source,/revocation_claim=\$2/);assert.doesNotMatch(source,/startRefresh|ingest_latest|tiktok\/rankings|console\.log/);
 const provider=read('../src/providers/tiktok.ts');assert.match(provider,/tiktok_not_enabled/);
});

test('Authorization-only accounts stay out of existing public audience projections',()=>{
 const queries=read('../src/modules/public/queries.ts'),directory=read('../src/modules/public/creator-index.ts');
 assert.equal((queries.match(/a\.platform IN \('youtube','instagram'\)/g)??[]).length,2);assert.equal((directory.match(/a\.platform IN \('youtube','instagram'\)/g)??[]).length,2);
});
