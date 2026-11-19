import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const server=readFileSync(new URL('../src/server.ts',import.meta.url),'utf8');
const bridge=readFileSync(new URL('../src/lib/unified-schema.ts',import.meta.url),'utf8');
const migration=readFileSync(new URL('../database/migrations/090_unified_human_creator.sql',import.meta.url),'utf8');
test('startup verifies unified review schema before serving requests',()=>{
 assert.match(server,/await ensureUnifiedSchema\(\)/);
 assert.ok(server.indexOf('await ensureUnifiedSchema()')<server.indexOf('httpServer.listen('));
});
test('schema change is additive and preserves review as pending',()=>{
 for(const field of ['human_review_status','human_reviewed_at','human_reviewed_by'])assert.ok(bridge.includes(field));
 assert.match(bridge,/DEFAULT 'pending'/);
 assert.doesNotMatch(bridge,/\bDROP\s+TABLE\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|\bUPDATE\s+creators\b/i);
 assert.match(migration,/IF NOT EXISTS/);
});
test('schema repair failure cannot independently stop legacy APIs',()=>{
 assert.match(server,/try \{\s*await ensureUnifiedSchema\(\);/);
 assert.match(server,/catch \(err\)/);
});
