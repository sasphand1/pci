import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const server=readFileSync(new URL('../src/server.ts',import.meta.url),'utf8');
const bridge=readFileSync(new URL('../src/lib/unified-schema.ts',import.meta.url),'utf8');
const migration=readFileSync(new URL('../database/migrations/090_unified_human_creator.sql',import.meta.url),'utf8');

test('Hostinger starts listening before slow schema/dependency initialization',()=>{
  const listen=server.indexOf('httpServer.listen(');
  const schema=server.indexOf('await ensureUnifiedSchema()');
  assert.ok(listen>=0,'HTTP listener is configured');
  assert.ok(schema>=0,'unified schema verification is configured');
  assert.ok(listen<schema,'listening must precede slow schema verification');
});

test('API requests remain gated until dependencies initialize',()=>{
  assert.match(server,/let\s+pciStartupReady\s*=\s*false/);
  assert.match(server,/if\s*\(!pciStartupReady\)\s*return\s+res\.status\(503\)/);
  assert.match(server,/await\s+ensureRedis\(\)[\s\S]*?pciStartupReady\s*=\s*true/);
  assert.match(server,/app\.get\('\/health\/ready'/);
});

test('schema change is additive and preserves review as pending',()=>{
  for(const field of ['human_review_status','human_reviewed_at','human_reviewed_by']) assert.ok(bridge.includes(field));
  assert.match(bridge,/DEFAULT 'pending'/);
  assert.doesNotMatch(bridge,/\bDROP\s+TABLE\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|\bUPDATE\s+creators\b/i);
  assert.match(migration,/IF NOT EXISTS/);
});

test('schema repair errors are caught separately from dependency startup errors',()=>{
  assert.match(server,/try\s*\{\s*await\s+ensureUnifiedSchema\(\);/);
  assert.match(server,/catch\s*\(\s*err\s*\)\s*\{/);
  assert.match(server,/Unified schema verification failed/);
  assert.match(server,/Backend dependency initialization failed/);
});

test('unified and cross-platform routes remain mounted',()=>{
  for(const route of ['unifiedPublicRoutes','unifiedAdminRoutes','crossPublicRoutes','crossAdminRoutes']){
    assert.match(server,new RegExp(`app\\.use\\('/api/v1(?:/admin)?',${route}\\)`));
  }
});
