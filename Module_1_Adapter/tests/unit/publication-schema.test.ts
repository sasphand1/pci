import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../../database/migrations/094_publication.sql', import.meta.url), 'utf8');
const src = readFileSync(new URL('../../src/lib/publication-schema.ts', import.meta.url), 'utf8');
const start = src.indexOf('PUBLICATION_SCHEMA_SQL=`') + 'PUBLICATION_SCHEMA_SQL=`'.length;
const SQL = src.slice(start, src.indexOf('`;', start));

test('startup DDL is byte-identical to migration 094', () => assert.equal(SQL, migration));
test('every CREATE is idempotent', () => {
  const creates = migration.match(/^CREATE (UNIQUE )?(TABLE|INDEX)[^\n]*/gm) ?? [];
  assert.ok(creates.length >= 9); for (const c of creates) assert.match(c, /IF NOT EXISTS/, c);
});
test('schema guard: every foreign key to people cascades, so a delete cannot leave a slot behind', () => {
  const refs = migration.match(/REFERENCES (people|accounts)\([^)]*\)[^,\n]*/g) ?? [];
  assert.ok(refs.length >= 1); for (const r of refs) assert.match(r, /ON DELETE CASCADE/, r);
});
test('a published pointer cannot lose its run, and slots are unique per run and per person', () => {
  assert.match(migration, /run_id uuid NOT NULL REFERENCES rank_runs\(id\) ON DELETE RESTRICT/);
  assert.match(migration, /PRIMARY KEY \(run_id, slot\)/); assert.match(migration, /UNIQUE \(run_id, person_id\)/);
});
test('only one pipeline can run at a time', () => assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS pipeline_runs_one_running ON pipeline_runs\(\(true\)\) WHERE status = 'running'/));
