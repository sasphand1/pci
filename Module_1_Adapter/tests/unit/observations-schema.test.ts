import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../../database/migrations/093_observations.sql', import.meta.url), 'utf8');
const src = readFileSync(new URL('../../src/lib/observations-schema.ts', import.meta.url), 'utf8');
const start = src.indexOf('OBSERVATIONS_SCHEMA_SQL=`') + 'OBSERVATIONS_SCHEMA_SQL=`'.length;
const SQL = src.slice(start, src.indexOf('`;', start));

test('startup DDL is byte-identical to migration 093', () => assert.equal(SQL, migration));
test('every CREATE is idempotent', () => {
  const creates = migration.match(/^CREATE (UNIQUE )?(TABLE|INDEX)[^\n]*/gm) ?? [];
  assert.ok(creates.length >= 7); for (const c of creates) assert.match(c, /IF NOT EXISTS/, c);
});
test('schema guard: every foreign key to accounts or people cascades (a hard delete leaves no history)', () => {
  const refs = migration.match(/REFERENCES (people|accounts)\([^)]*\)[^,\n]*/g) ?? [];
  assert.ok(refs.length >= 2); for (const r of refs) assert.match(r, /ON DELETE CASCADE/, r);
});
test('observations can never hold a negative value or an unknown metric', () => {
  assert.match(migration, /CHECK \(value >= 0\)/); assert.match(migration, /metric IN \('followers','views','posts_30d'\)/);
});
test('one active refresh per platform is enforced by the database', () => {
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS refresh_runs_one_active_per_platform ON refresh_runs\(platform\) WHERE status IN \('queued','running'\)/);
});
test('one observation per account, metric and run', () => assert.match(migration, /UNIQUE \(account_id, metric, run_id\)/));
