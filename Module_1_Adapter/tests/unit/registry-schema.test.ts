import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const migration = readFileSync(new URL('../../database/migrations/092_registry.sql', import.meta.url), 'utf8');
// Read the source text instead of importing it: importing would load the DB pool and config.
const src = readFileSync(new URL('../../src/lib/registry-schema.ts', import.meta.url), 'utf8');
const start = src.indexOf('REGISTRY_SCHEMA_SQL=`') + 'REGISTRY_SCHEMA_SQL=`'.length;
const REGISTRY_SCHEMA_SQL = src.slice(start, src.indexOf('`;', start));
test('startup DDL is byte-identical to migration 092', () => assert.equal(REGISTRY_SCHEMA_SQL, migration));
test('migration is idempotent in form: every CREATE has IF NOT EXISTS', () => {
  const creates = migration.match(/^CREATE (UNIQUE )?(TABLE|INDEX)[^\n]*/gm) ?? [];
  assert.ok(creates.length >= 6); for (const c of creates) assert.match(c, /IF NOT EXISTS/, c);
});
test('schema guard: every foreign key to people or accounts cascades, so deletion cannot leave rows behind', () => {
  const refs = migration.match(/REFERENCES (people|accounts)\([^)]*\)[^,\n]*/g) ?? [];
  assert.ok(refs.length >= 2); for (const r of refs) assert.match(r, /ON DELETE CASCADE/, r);
});
test('exactly one primary category per person is enforced by a partial unique index', () => {
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS person_categories_one_primary_uq ON person_categories\(person_id\) WHERE is_primary/);
});
test('one account per platform per person and one person per provider account', () => {
  assert.match(migration, /UNIQUE \(person_id, platform\)/); assert.match(migration, /UNIQUE \(platform, external_id\)/);
});
test('migration file name follows the runner convention and sorts after 091', () => {
  const names = readdirSync(new URL('../../database/migrations/', import.meta.url)).filter(n => /^\d{3}_[a-z0-9_]+\.sql$/.test(n)).sort();
  assert.ok(names.includes('092_registry.sql')); assert.ok(names.indexOf('092_registry.sql') > names.indexOf('091_engine_foundation.sql'));
});
