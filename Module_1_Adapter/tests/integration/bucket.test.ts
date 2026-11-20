// Runs against a REAL PostgreSQL *_test database (see .env.test.example). Never run on production data.
// Uses a fake resolver, so no YouTube/Instagram call is made.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pool, query } from '../../src/lib/db.js';
import { ensureRegistrySchema } from '../../src/lib/registry-schema.js';
import { commitBatch, deletePerson, listBucket, previewBatch, setCategories } from '../../src/modules/bucket/service.js';
import type { Resolver } from '../../src/modules/bucket/resolver.js';
import type { ResolveResult } from '../../src/modules/bucket/classify.js';

if (process.env.NODE_ENV !== 'test' || !/\/[^/]*_test(?:\?|$)/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('Refusing writable integration tests: set NODE_ENV=test and use a separate *_test PostgreSQL database');
}

const UC = (n: number) => 'UC' + String(n).padStart(22, '0');
function fake(map: Record<string, ResolveResult>): Resolver {
  return { async resolve(_p, parsed) { return map[parsed.value] ?? { ok: false, reason: 'not_found' }; } };
}
const yt = fake({ duckybhai: { ok: true, externalId: UC(1), handle: '@duckybhai', displayName: 'Ducky Bhai' }, rajabbutt: { ok: true, externalId: UC(2), handle: '@rajabbutt', displayName: 'Rajab Butt' }, zzz999: { ok: true, externalId: UC(3), handle: '@zzz999', displayName: 'Zed' } });
const ig = fake({ ducky_ig: { ok: true, externalId: '111', handle: 'ducky_ig' } });
const counts = async () => Object.fromEntries(await Promise.all(['people', 'accounts', 'person_categories'].map(async t => [t, Number((await query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n)])));

test.before(async () => {
  await ensureRegistrySchema();
  await query('TRUNCATE people CASCADE');
  await query(`INSERT INTO categories(slug,label) VALUES('gamer','Gamer'),('cooking','Cooking') ON CONFLICT (slug) DO NOTHING`);
});
test.after(async () => { await pool.end(); });

test('A1 add one: person, account and primary category are created together', async () => {
  const r = await commitBatch('youtube', '@duckybhai, , gamer', null, yt);
  assert.equal(r.added, 1);
  const c = await counts(); assert.deepEqual(c, { people: 1, accounts: 1, person_categories: 1 });
  const row = (await query('SELECT is_primary FROM person_categories')).rows[0]; assert.equal(row.is_primary, true);
});
test('A2 preview writes nothing', async () => {
  const before = await counts();
  const r = await previewBatch('youtube', 'rajabbutt\nnotfound1', yt);
  assert.deepEqual(r.rows.map(x => x.status), ['resolved', 'not_found']);
  assert.deepEqual(await counts(), before);
});
test('A3 duplicates and bad rows are reported and do not block good rows', async () => {
  const r = await commitBatch('youtube', 'duckybhai\nrajabbutt\nbad handle\nmissing99', null, yt);
  assert.deepEqual(r.rows.map(x => x.status), ['duplicate_in_bucket', 'resolved', 'invalid_format', 'not_found']);
  assert.equal(r.added, 1); assert.equal((await counts()).accounts, 2);
});
test('A4 typed person name links an Instagram account to the existing person; no new person is made', async () => {
  const before = await counts();
  const r = await commitBatch('instagram', 'ducky_ig, Ducky Bhai', null, ig);
  assert.equal(r.added, 1);
  const after = await counts(); assert.equal(after.people, before.people); assert.equal(after.accounts, before.accounts + 1);
  const list = await listBucket({ limit: 50, offset: 0 });
  const ducky = list.rows.find((p: any) => p.displayName === 'Ducky Bhai') as any; assert.equal(ducky.accounts.length, 2);
});
test('database refuses a second account on the same platform for one person, and the same provider account twice', async () => {
  const p = (await query(`SELECT person_id FROM accounts WHERE handle='@duckybhai'`)).rows[0].person_id;
  await assert.rejects(query(`INSERT INTO accounts(person_id,platform,external_id,handle) VALUES($1,'youtube','other','x')`, [p]), /accounts_person_platform_uq/);
  await assert.rejects(query(`INSERT INTO accounts(person_id,platform,external_id,handle) SELECT id,'instagram','111','y' FROM people WHERE slug<>(SELECT slug FROM people WHERE id=$1) LIMIT 1`, [p]), /accounts_platform_external_uq/);
});
test('database allows only one primary category per person', async () => {
  const p = (await query(`SELECT person_id FROM person_categories LIMIT 1`)).rows[0].person_id;
  await assert.rejects(query(`INSERT INTO person_categories(person_id,category_id,is_primary) SELECT $1,id,true FROM categories WHERE slug='cooking'`, [p]), /person_categories_one_primary_uq/);
});
test('change niche replaces categories and keeps exactly one primary', async () => {
  const p = (await query(`SELECT id FROM people WHERE slug='ducky-bhai'`)).rows[0].id;
  await setCategories(p, ['gamer', 'cooking'], 'cooking', null);
  const rows = (await query(`SELECT c.slug, pc.is_primary FROM person_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.person_id=$1`, [p])).rows;
  assert.equal(rows.length, 2); assert.deepEqual(rows.filter((r: any) => r.is_primary).map((r: any) => r.slug), ['cooking']);
  await assert.rejects(setCategories(p, ['gamer'], 'cooking', null), /primary category/i);
});
test('A5 concurrent identical commits never create duplicates', async () => {
  const results = await Promise.all([commitBatch('youtube', 'zzz999', null, yt), commitBatch('youtube', 'zzz999', null, yt)]);
  assert.equal(results.reduce((n, r) => n + r.added, 0), 1);
  assert.equal(Number((await query(`SELECT count(*)::int AS n FROM accounts WHERE external_id=$1`, [UC(3)])).rows[0].n), 1);
});
test('A6 hard delete leaves nothing behind: no rows reference the person in any table', async () => {
  const p = (await query(`SELECT id FROM people WHERE slug='ducky-bhai'`)).rows[0].id;
  const out = await deletePerson(p, null);
  assert.equal(out.deleted, true); assert.equal(out.accounts, 2);
  // Every table with a person_id column must be empty for this person.
  const tables = (await query(`SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='person_id'`)).rows.map((r: any) => r.table_name);
  assert.ok(tables.includes('accounts') && tables.includes('person_categories'));
  for (const t of tables) assert.equal(Number((await query(`SELECT count(*)::int AS n FROM ${t} WHERE person_id=$1`, [p])).rows[0].n), 0, t);
  assert.equal(Number((await query(`SELECT count(*)::int AS n FROM accounts WHERE handle IN ('@duckybhai','ducky_ig')`)).rows[0].n), 0);
  await assert.rejects(deletePerson(p, null), /not found/i);
});
test('delete also removes linked legacy rows in the same transaction', async () => {
  const legacy = (await query(`INSERT INTO creators(channel_id,display_name,slug) VALUES($1,'Legacy One','legacy-one') RETURNING id`, [UC(99)])).rows[0].id;
  const pid = (await query(`INSERT INTO people(slug,display_name) VALUES('legacy-one','Legacy One') RETURNING id`)).rows[0].id;
  await query(`INSERT INTO accounts(person_id,platform,external_id,handle,legacy_creator_id) VALUES($1,'youtube',$2,'x',$3)`, [pid, UC(99), legacy]);
  const out = await deletePerson(pid, null);
  assert.equal(out.legacyRows, 1);
  assert.equal(Number((await query(`SELECT count(*)::int AS n FROM creators WHERE id=$1`, [legacy])).rows[0].n), 0);
});
test('audit rows record counts and ids only, never names or handles', async () => {
  const rows = (await query(`SELECT action, subject, metadata::text AS m FROM admin_audit_logs WHERE action LIKE 'bucket.%'`)).rows;
  assert.ok(rows.length >= 3);
  for (const r of rows) assert.ok(!/ducky|rajab|@/i.test(String(r.m)), r.m);
});
test('completeness: every person has at least one account (no empty people after any operation)', async () => {
  assert.equal(Number((await query(`SELECT count(*)::int AS n FROM people p WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.person_id=p.id)`)).rows[0].n), 0);
});
