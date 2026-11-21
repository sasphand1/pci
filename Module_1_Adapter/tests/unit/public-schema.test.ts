import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../../database/migrations/095_public.sql', import.meta.url), 'utf8');
const src = readFileSync(new URL('../../src/lib/public-schema.ts', import.meta.url), 'utf8');
const start = src.indexOf('PUBLIC_SCHEMA_SQL=`') + 'PUBLIC_SCHEMA_SQL=`'.length;
const SQL = src.slice(start, src.indexOf('`;', start));

test('startup DDL is byte-identical to migration 095', () => assert.equal(SQL, migration));
test('migration 095 can run twice', () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS avatar_url text/);
  for (const c of migration.match(/^CREATE (UNIQUE )?INDEX[^\n]*/gm) ?? []) assert.match(c, /IF NOT EXISTS/, c);
});
test('it only adds; nothing is dropped or rewritten', () => assert.doesNotMatch(migration, /\bDROP\b|\bDELETE\b|\bUPDATE\b|\bTRUNCATE\b/i));
