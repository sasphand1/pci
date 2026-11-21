// Real PostgreSQL *_test database. The Overview reads real rows, never placeholders.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pool, query } from '../../src/lib/db.js';
import { ensureRegistrySchema } from '../../src/lib/registry-schema.js';
import { ensureObservationsSchema } from '../../src/lib/observations-schema.js';
import { ensurePublicationSchema } from '../../src/lib/publication-schema.js';
import { buildBatch, publishBatch } from '../../src/modules/publish/service.js';
import { deletePerson } from '../../src/modules/bucket/service.js';
import { getOverview } from '../../src/modules/publish/overview.js';

if (process.env.NODE_ENV !== 'test' || !/\/[^/]*_test(?:\?|$)/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('Refusing writable integration tests: set NODE_ENV=test and use a separate *_test PostgreSQL database');
}
async function clean() { for (const t of ['pipeline_alerts', 'pipeline_runs', 'published_pointers', 'rank_runs', 'refresh_runs', 'worker_heartbeats']) await query(`TRUNCATE ${t} CASCADE`); await query('TRUNCATE people CASCADE'); }
test.before(async () => {
  await ensureRegistrySchema(); await ensureObservationsSchema(); await ensurePublicationSchema();
  await query(`CREATE TABLE IF NOT EXISTS worker_heartbeats (worker_id text PRIMARY KEY, kind text NOT NULL CHECK (kind IN ('worker','embedded')), last_seen_at timestamptz NOT NULL DEFAULT now(), detail jsonb NOT NULL DEFAULT '{}'::jsonb)`);
  await clean(); await query(`INSERT INTO categories(slug,label) VALUES('gamer','Gamer') ON CONFLICT (slug) DO NOTHING`);
});
test.beforeEach(clean);
test.after(async () => { await clean(); await pool.end(); });

let seq = 0;
async function person(followers: number | null, o: { category?: boolean; ageHours?: number; allMetrics?: boolean } = {}) {
  const k = ++seq;
  const id = (await query('INSERT INTO people(slug,display_name) VALUES($1,$2) RETURNING id', [`ov-${k}`, `Overview ${k}`])).rows[0].id;
  const acc = (await query(`INSERT INTO accounts(person_id,platform,external_id,handle) VALUES($1,'youtube',$2,$3) RETURNING id`, [id, 'UC' + String(k).padStart(22, '0'), `ov${k}`])).rows[0].id;
  if (followers !== null) await query(`INSERT INTO metric_observations(account_id,metric,value,observed_at) VALUES($1,'followers',$2, now() - make_interval(hours => $3))`, [acc, followers, o.ageHours ?? 1]);
  // Every ranking (subscribed, viewed, active) needs fresh data or its coverage gate rightly rejects it and raises an alert.
  if (o.allMetrics) for (const m of ['views', 'posts_30d']) await query(`INSERT INTO metric_observations(account_id,metric,value,observed_at) VALUES($1,$2,$3, now() - interval '1 hour')`, [acc, m, (followers ?? 0) + 1]);
  if (o.category) await query(`INSERT INTO person_categories(person_id,category_id,is_primary) SELECT $1,id,true FROM categories WHERE slug='gamer'`, [id]);
  return { id, acc };
}

test('empty system: zeros, nothing published, the worker has not been seen', async () => {
  const o = await getOverview();
  assert.equal(o.people, 0); assert.equal(o.accounts.total, 0); assert.equal(o.audience.total, 0); assert.equal(o.lastPublishedAt, null);
  assert.equal(o.state.level, 'down'); assert.equal(o.worker.healthy, null); assert.deepEqual(o.top, []); assert.deepEqual(o.attention, []);
});

test('counts, audience from fresh readings only, and attention items', async () => {
  await person(1000, { category: true }); await person(2000, { category: true });
  await person(null, { category: true });            // account with no reading at all
  await person(9_000_000, { ageHours: 24 * 10 });    // reading older than 7 days is not a number
  const o = await getOverview();
  assert.equal(o.people, 4); assert.equal(o.accounts.youtube, 4); assert.equal(o.accounts.withNumbers, 2);
  assert.equal(o.audience.youtube, 3000, 'stale and missing readings are never added'); assert.equal(o.audience.total, 3000);
  const keys = Object.fromEntries(o.attention.map(a => [a.key, a.count]));
  assert.equal(keys.no_numbers, 2); assert.equal(keys.no_category, 1);
});

test('a live worker heartbeat and a published ranking make the system ok; the top list is the published wheel', async () => {
  for (let i = 1; i <= 7; i++) await person(i * 1000, { category: true, allMetrics: true });
  await query(`INSERT INTO worker_heartbeats(worker_id,kind,last_seen_at) VALUES('t','worker',now())`);
  const b = await buildBatch('manual', null); await publishBatch(b.batchId, null);
  const o = await getOverview();
  assert.ok(o.lastPublishedAt); assert.equal(o.worker.healthy, true); assert.equal(o.state.level, 'ok', o.state.reasons.join('; '));
  assert.equal(o.top.length, 5); assert.deepEqual(o.top.map(t => t.slot), [1, 2, 3, 4, 5]); assert.equal(o.top[0].value, '7000');
});

test('hard delete leaves no trace in the overview', async () => {
  const keep = await person(5000, { category: true, allMetrics: true }); const gone = await person(8000, { category: true, allMetrics: true });
  await query(`INSERT INTO worker_heartbeats(worker_id,kind,last_seen_at) VALUES('t','worker',now())`);
  const b = await buildBatch('manual', null); await publishBatch(b.batchId, null);
  await deletePerson(gone.id, null);
  const o = await getOverview();
  assert.equal(o.people, 1); assert.equal(o.audience.total, 5000); assert.ok(!o.top.some(t => t.displayName.includes('Overview') && t.value === '8000'));
  assert.equal(o.top.length, 1); assert.equal(o.top[0].value, '5000'); void keep;
});

test('an unacknowledged alert is counted and reported', async () => {
  await query(`INSERT INTO pipeline_alerts(kind,scope,message) VALUES('gate','wheel.subscribed','x')`);
  const o = await getOverview();
  assert.equal(o.openAlerts, 1); assert.ok(o.attention.some(a => a.key === 'alerts'));
});
