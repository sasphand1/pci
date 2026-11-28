// Real PostgreSQL *_test database, mocked providers: no network. See .env.test.example.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pool, query } from '../../src/lib/db.js';
import { ensureRegistrySchema } from '../../src/lib/registry-schema.js';
import { ensureObservationsSchema } from '../../src/lib/observations-schema.js';
import { ensurePublicationSchema } from '../../src/lib/publication-schema.js';
import { activeRefreshCount, buildBatch, getBatch, getPublication, listPublications, publishBatch, rollbackScope } from '../../src/modules/publish/service.js';
import { createDailyPipelineRun, createPipelineRun, executePipeline, waitForRefreshes } from '../../src/modules/publish/pipeline.js';
import { getPipelineStatus } from '../../src/modules/publish/status.js';
import { deletePerson } from '../../src/modules/bucket/service.js';
import type { Deps } from '../../src/modules/refresh/service.js';
import type { AccountRef, FetchResult } from '../../src/providers/types.js';

if (process.env.NODE_ENV !== 'test' || !/\/[^/]*_test(?:\?|$)/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('Refusing writable integration tests: set NODE_ENV=test and use a separate *_test PostgreSQL database');
}

const n = async (sql: string, v: unknown[] = []) => Number((await query(sql, v)).rows[0].n);
async function clean() { for (const t of ['pipeline_alerts', 'pipeline_runs', 'published_pointers', 'rank_runs', 'refresh_runs']) await query(`TRUNCATE ${t} CASCADE`); await query('TRUNCATE people CASCADE'); }
test.before(async () => {
  await ensureRegistrySchema(); await ensureObservationsSchema(); await ensurePublicationSchema(); await clean();
  await query(`INSERT INTO categories(slug,label) VALUES('gamer','Gamer'),('cook','Cook') ON CONFLICT (slug) DO NOTHING`);
});
test.beforeEach(clean);
test.after(async () => { await clean(); await pool.end(); });

type P = { person: string; account: string; value: number };
let seq = 0;
/** People with one YouTube account each and fresh observations, value = base + i*10 (strictly ordered). */
async function seed(count: number, base = 1000, opts: { category?: string; observations?: boolean } = {}): Promise<P[]> {
  const out: P[] = [];
  for (let i = 0; i < count; i++) {
    const k = ++seq, value = base + i * 10;
    const person = (await query('INSERT INTO people(slug,display_name) VALUES($1,$2) RETURNING id', [`pp-${k}`, `Person ${k}`])).rows[0].id;
    const account = (await query(`INSERT INTO accounts(person_id,platform,external_id,handle) VALUES($1,'youtube',$2,$3) RETURNING id`, [person, `ext-${k}`, `h${k}`])).rows[0].id;
    if (opts.category) await query(`INSERT INTO person_categories(person_id,category_id,is_primary) SELECT $1,id,true FROM categories WHERE slug=$2`, [person, opts.category]);
    if (opts.observations !== false) await observe(account, value);
    out.push({ person, account, value });
  }
  return out;
}
async function observe(account: string, followers: number, ageHours = 1) {
  for (const [metric, value] of [['followers', followers], ['views', followers * 10], ['posts_30d', 3]] as const)
    await query(`INSERT INTO metric_observations(account_id,metric,value,observed_at) VALUES($1,$2,$3, now() - make_interval(hours => $4))`, [account, metric, value, ageHours]);
}
const publishAll = async () => { const b = await buildBatch('manual', null); const p = await publishBatch(b.batchId, null); return { ...b, ...p }; };

/** Every live ranking is internally consistent and refers only to people that exist. */
async function assertConsistent(label: string) {
  for (const p of (await query('SELECT scope, run_id FROM published_pointers')).rows) {
    const s = (await query('SELECT slot, rank, value::int AS value FROM rank_slots WHERE run_id=$1 ORDER BY slot', [p.run_id])).rows;
    s.forEach((r: any, i: number) => {
      assert.equal(r.slot, i + 1, `${label} ${p.scope}: slots must be 1..N`);
      assert.equal(r.rank, 1 + s.filter((x: any) => x.value > r.value).length, `${label} ${p.scope}: rank of slot ${r.slot}`);
      if (i) assert.ok(r.value <= s[i - 1].value, `${label} ${p.scope}: values must not increase`);
    });
    assert.equal(await n(`SELECT count(*)::int AS n FROM rank_slots s LEFT JOIN people pe ON pe.id=s.person_id WHERE s.run_id=$1 AND pe.id IS NULL`, [p.run_id]), 0, `${label} ${p.scope}: orphan slot`);
    assert.equal((await query(`SELECT status FROM rank_runs WHERE id=$1`, [p.run_id])).rows[0].status, 'published', `${label} ${p.scope}: pointer must reference a published run`);
  }
  assert.equal(await n(`SELECT count(*)::int AS n FROM (SELECT scope FROM rank_runs WHERE status='published' GROUP BY scope HAVING count(*)>1) x`), 0, `${label}: one published run per scope`);
}

test('Rank builds drafts for every scope and changes nothing public; Publish makes them live', async () => {
  await seed(8, 1000, { category: 'gamer' });
  const b = await buildBatch('manual', null);
  assert.deepEqual(b.drafts.map(d => d.scope).sort(), ['category.gamer', 'wheel.active', 'wheel.subscribed', 'wheel.viewed', 'youtube.subscribed']); // instagram.followers has nobody, so no draft
  assert.equal(await n('SELECT count(*)::int AS n FROM published_pointers'), 0);
  const review = await getBatch(b.batchId);
  const w = review.scopes.find(s => s.scope === 'wheel.subscribed')!;
  assert.equal(w.status, 'draft'); assert.equal(w.top[0].value, 1070); assert.equal(w.diff.counts.entered, 8); assert.equal(w.hasLive, false);
  const p = await publishBatch(b.batchId, null);
  assert.equal(p.published.length, 5); assert.deepEqual(p.rejected, []);
  assert.equal((await listPublications()).length, 5);
  const live = await getPublication('wheel.subscribed');
  assert.equal(live.entries.length, 8); assert.equal(live.entries[0].slot, 1); assert.equal(live.entries[0].value, 1070); assert.match(live.entries[0].displayName, /^Person /);
  await assertConsistent('after first publish');
  await assert.rejects(publishBatch(b.batchId, null), /no drafts left/); // publishing twice does nothing twice
});

test('D1 a draft that fails a gate leaves the live ranking unchanged and records an alert', async () => {
  const people = await seed(10);
  const first = await publishAll();
  assert.equal(first.rejected.length, 0);
  const before = (await query(`SELECT run_id FROM published_pointers WHERE scope='wheel.subscribed'`)).rows[0].run_id;
  // 8 of 10 people lose their fresh data: coverage drops to 20%
  for (const p of people.slice(0, 8)) await query('UPDATE metric_observations SET observed_at = now() - interval \'20 days\' WHERE account_id=$1', [p.account]);
  const second = await buildBatch('manual', null);
  const d = second.drafts.find(x => x.scope === 'wheel.subscribed')!; assert.equal(d.gateFailures[0].gate, 'coverage');
  const out = await publishBatch(second.batchId, null);
  assert.ok(out.rejected.some(r => r.scope === 'wheel.subscribed' && r.failures[0].gate === 'coverage'));
  assert.equal((await query(`SELECT run_id FROM published_pointers WHERE scope='wheel.subscribed'`)).rows[0].run_id, before); // live ranking untouched
  assert.equal((await query('SELECT status FROM rank_runs WHERE id=$1', [d.runId])).rows[0].status, 'rejected');
  const alerts = (await query(`SELECT kind, scope FROM pipeline_alerts WHERE NOT acknowledged`)).rows;
  assert.ok(alerts.some((a: any) => a.kind === 'gate_failed' && a.scope === 'wheel.subscribed'));
  await assertConsistent('after rejected publish');
});
test('D1 a tampered draft (hash no longer reproduces) is rejected', async () => {
  await seed(6);
  const b = await buildBatch('manual', null);
  await query(`UPDATE rank_runs SET input_hash='tampered' WHERE id=$1`, [b.drafts[0].runId]);
  const out = await publishBatch(b.batchId, null);
  assert.ok(out.rejected.some(r => r.failures.some(f => f.gate === 'input_hash')));
  assert.equal(out.published.length, b.drafts.length - 1);
});
test('D1 a draft that went stale because someone was deleted after Rank cannot be published', async () => {
  const people = await seed(6);
  const b = await buildBatch('manual', null);
  await deletePerson(people[2].person, null);
  const out = await publishBatch(b.batchId, null);
  assert.equal(out.published.length, 0); assert.ok(out.rejected.every(r => r.failures.some(f => f.gate === 'slots_gap_free' || f.gate === 'valid_references' || f.gate === 'input_hash')));
  assert.equal(await n('SELECT count(*)::int AS n FROM published_pointers'), 0);
});

test('D2 one person jumping from slot 40 to slot 1 does not block publishing', async () => {
  const people = await seed(50);
  await publishAll();
  const mover = people[10]; // value 1100: 40th of 50
  assert.equal((await getPublication('wheel.subscribed', 200)).entries.find(e => e.personId === mover.person)!.slot, 40);
  await query(`INSERT INTO metric_observations(account_id,metric,value,observed_at) VALUES($1,'followers',9000000,now())`, [mover.account]);
  const b = await buildBatch('manual', null);
  const review = await getBatch(b.batchId);
  assert.deepEqual(review.scopes.find(s => s.scope === 'wheel.subscribed')!.diff.moved[0], { personId: mover.person, from: 40, to: 1, delta: 39, displayName: review.scopes.find(s => s.scope === 'wheel.subscribed')!.diff.moved[0].displayName });
  const out = await publishBatch(b.batchId, null);
  assert.ok(out.published.includes('wheel.subscribed')); assert.equal((await getPublication('wheel.subscribed')).entries[0].personId, mover.person);
  await assertConsistent('after big move');
});

test('D3 deleting a person updates every published scope in the same transaction', async () => {
  const people = await seed(12, 1000, { category: 'gamer' });
  await publishAll();
  const victim = people[8]; // value 1080: slot 4 of 12
  const before = new Map((await getPublication('wheel.subscribed', 200)).entries.map(e => [e.personId, e.value]));
  const out = await deletePerson(victim.person, null);
  assert.equal(out.republishedScopes, 5); // wheel x3, youtube, category.gamer
  for (const scope of ['wheel.subscribed', 'wheel.viewed', 'wheel.active', 'youtube.subscribed', 'category.gamer']) {
    const live = await getPublication(scope, 200);
    assert.ok(!live.entries.some(e => e.personId === victim.person), scope); assert.equal(live.entries.length, 11, scope); assert.equal(live.covered, 11); assert.equal(live.population, 11);
  }
  const after = (await getPublication('wheel.subscribed', 200)).entries;
  for (const e of after) assert.equal(e.value, before.get(e.personId)); // nobody else's value moved
  assert.deepEqual(after.map(e => e.slot), after.map((_, i) => i + 1));
  assert.equal(await n('SELECT count(*)::int AS n FROM rank_slots WHERE person_id=$1', [victim.person]), 0); // not in any run, old or new
  assert.equal(await n('SELECT count(*)::int AS n FROM people WHERE id=$1', [victim.person]), 0);
  await assertConsistent('after delete');
  // the audit log records counts only
  const audit = (await query(`SELECT metadata::text AS m FROM admin_audit_logs WHERE action='bucket.delete' AND subject=$1`, [victim.person])).rows;
  assert.ok(audit.length === 1 && !/Person|h\d+/.test(audit[0].m));
});
test('D3 deleting when nothing is published still works; deleting an unranked person updates the scope population', async () => {
  const [a] = await seed(1, 1000, { observations: false });
  assert.equal((await deletePerson(a.person, null)).republishedScopes, 0);
  const people = await seed(5); const [stale] = await seed(1, 1000, { observations: false });
  await publishAll();
  assert.equal((await getPublication('wheel.subscribed')).unranked.length, 1);
  await deletePerson(stale.person, null);
  const live = await getPublication('wheel.subscribed'); assert.equal(live.unranked.length, 0); assert.equal(live.population, 5); assert.equal(people.length, live.entries.length);
});
test('deleting a person removes their observations and refresh history as well', async () => {
  const [p, q] = await seed(2);
  await publishAll(); await deletePerson(p.person, null);
  assert.equal(await n('SELECT count(*)::int AS n FROM metric_observations WHERE account_id=$1', [p.account]), 0);
  assert.ok(await n('SELECT count(*)::int AS n FROM metric_observations WHERE account_id=$1', [q.account]) > 0);
});

test('rollback restores the previous ranking; it is refused when that ranking contains someone who has since been deleted', async () => {
  const people = await seed(6);
  const a = await publishAll(); const runA = (await query(`SELECT run_id FROM published_pointers WHERE scope='wheel.subscribed'`)).rows[0].run_id;
  await query(`INSERT INTO metric_observations(account_id,metric,value,observed_at) VALUES($1,'followers',777777,now())`, [people[0].account]);
  await publishAll();
  assert.equal((await getPublication('wheel.subscribed')).entries[0].personId, people[0].person);
  const r = await rollbackScope('wheel.subscribed', null); assert.equal(r.runId, runA);
  assert.equal((await getPublication('wheel.subscribed')).entries[0].personId, people[5].person);
  await assertConsistent('after rollback');
  // Deleting the person who is first in the restored ranking replaces the live ranking with one without them,
  // and the older ranking that still listed them can no longer be restored.
  await deletePerson(people[5].person, null);
  assert.equal((await getPublication('wheel.subscribed')).entries[0].personId, people[4].person);
  await assert.rejects(rollbackScope('wheel.subscribed', null), /no longer valid/i);
  await assertConsistent('after refused rollback');
  assert.ok(a.published.length > 0);
});

test('D4 scenario: import 50, refresh, rank, publish; add 20, again; delete 10. Everything is consistent after every step', async () => {
  const values = new Map<string, number>();
  const deps: Deps = { now: () => new Date(), sleep: async () => {}, backoff: () => 0, background: false, providers: {
    youtube: { platform: 'youtube', async fetch(accts: AccountRef[]): Promise<FetchResult[]> {
      return accts.map(a => ({ accountId: a.id, outcome: 'ok' as const, metrics: [
        { metric: 'followers' as const, value: values.get(a.id) ?? 1, accuracy: 'exact' as const }, { metric: 'views' as const, value: (values.get(a.id) ?? 1) * 10, accuracy: 'exact' as const }, { metric: 'posts_30d' as const, value: 2, accuracy: 'exact' as const }] }));
    } },
    instagram: { platform: 'instagram', async fetch() { return []; } } } };
  const step = async (label: string) => {
    const run = await createPipelineRun('manual', null); assert.equal(run.started, true, label);
    assert.equal(await executePipeline(run.id, 'manual', null, deps), 'succeeded', label);
    await assertConsistent(label);
  };
  const first = await seed(50, 0, { observations: false, category: 'gamer' }); first.forEach((p, i) => values.set(p.account, 5000 + i * 7));
  await step('after first 50');
  assert.equal((await getPublication('wheel.subscribed', 200)).entries.length, 50);
  assert.equal((await getPublication('wheel.subscribed')).entries[0].value, 5000 + 49 * 7);
  const more = await seed(20, 0, { observations: false, category: 'cook' }); more.forEach((p, i) => values.set(p.account, 9000 + i * 3));
  await step('after adding 20');
  const wheel = await getPublication('wheel.subscribed', 200); assert.equal(wheel.entries.length, 70); assert.equal(wheel.entries[0].value, 9000 + 19 * 3);
  assert.equal((await getPublication('category.cook')).entries.length, 20); assert.equal((await getPublication('category.gamer')).entries.length, 50);
  const gone = [...first.slice(0, 6), ...more.slice(0, 4)];
  for (const g of gone) { await deletePerson(g.person, null); await assertConsistent(`after deleting ${g.person}`); }
  assert.equal((await getPublication('wheel.subscribed', 200)).entries.length, 60);
  assert.equal((await getPublication('category.cook')).entries.length, 16); assert.equal((await getPublication('category.gamer')).entries.length, 44);
  for (const g of gone) assert.equal(await n('SELECT count(*)::int AS n FROM rank_slots WHERE person_id=$1', [g.person]), 0);
  await step('after delete then another full run');
  assert.equal((await getPublication('wheel.subscribed', 200)).entries.length, 60);
  const pipeline = (await query('SELECT status, steps FROM pipeline_runs ORDER BY created_at')).rows;
  assert.ok(pipeline.every((r: any) => r.status === 'succeeded')); assert.deepEqual(pipeline[0].steps.map((s: any) => s.step), ['refresh', 'rank', 'publish']);
});

test('a pipeline whose refresh fails completely does not damage the live ranking: coverage gate keeps it and raises an alert', async () => {
  const people = await seed(10);
  await publishAll();
  const live = (await query(`SELECT run_id FROM published_pointers WHERE scope='wheel.subscribed'`)).rows[0].run_id;
  for (const p of people) await query(`UPDATE metric_observations SET observed_at = now() - interval '9 days' WHERE account_id=$1`, [p.account]); // data has aged out
  const deps: Deps = { now: () => new Date(), sleep: async () => {}, backoff: () => 0, background: false, providers: {
    youtube: { platform: 'youtube', async fetch(a) { return a.map(x => ({ accountId: x.id, outcome: 'error' as const, metrics: [], detail: 'down' })); } }, instagram: { platform: 'instagram', async fetch() { return []; } } } };
  const run = await createPipelineRun('scheduled', null);
  assert.equal(await executePipeline(run.id, 'scheduled', null, deps), 'partial');
  assert.equal((await query(`SELECT run_id FROM published_pointers WHERE scope='wheel.subscribed'`)).rows[0].run_id, live);
  assert.ok(await n(`SELECT count(*)::int AS n FROM pipeline_alerts WHERE kind='gate_failed' AND NOT acknowledged`) > 0);
  const st = await getPipelineStatus();
  assert.ok(st.alerts.length > 0); assert.equal(st.bucket.people, 10); assert.ok(st.live.some((l: any) => l.scope === 'wheel.subscribed'));
});
test('only one pipeline can run at a time; a pipeline left running for over an hour is recovered', async () => {
  const a = await createPipelineRun('manual', null), b = await createPipelineRun('manual', null);
  assert.equal(a.started, true); assert.equal(b.started, false); assert.equal(b.id, a.id);
  await query(`UPDATE pipeline_runs SET created_at = now() - interval '2 hours' WHERE id=$1`, [a.id]);
  const c = await createPipelineRun('manual', null); assert.equal(c.started, true); assert.notEqual(c.id, a.id);
  assert.equal((await query('SELECT status FROM pipeline_runs WHERE id=$1', [a.id])).rows[0].status, 'failed');
});

test('flow: ranking while numbers are still arriving is detected; the pipeline waits until the refresh finishes', async () => {
  await seed(10);
  assert.equal(await activeRefreshCount(), 0);
  const run = (await query(`INSERT INTO refresh_runs(platform,trigger,status,started_at,heartbeat_at) VALUES('youtube','manual','running', now(), now()) RETURNING id`)).rows[0].id;
  assert.equal(await activeRefreshCount(), 1);
  // The refresh finishes after two polls; the wait must not return before that.
  let polls = 0;
  const waited = await waitForRefreshes({ sleep: async () => { polls++; if (polls === 2) await query(`UPDATE refresh_runs SET status='succeeded', finished_at=now() WHERE id=$1`, [run]); } }, 60_000, 1000);
  assert.equal(waited, true); assert.equal(polls, 2); assert.equal(await activeRefreshCount(), 0);
  // A refresh that never finishes is given up on after the limit, never forever.
  await query(`UPDATE refresh_runs SET status='running', finished_at=NULL WHERE id=$1`, [run]);
  assert.equal(await waitForRefreshes({ sleep: async () => {} }, 5000, 1000), false);
});

test('flow: an alert clears itself when that ranking publishes; unrelated alerts stay', async () => {
  const people = await seed(10);
  await publishAll();
  for (const p of people.slice(0, 8)) await query("UPDATE metric_observations SET observed_at = now() - interval '20 days' WHERE account_id=$1", [p.account]);
  await publishAll(); // rejected by coverage: alerts raised
  assert.ok(await n(`SELECT count(*)::int AS n FROM pipeline_alerts WHERE kind='gate_failed' AND NOT acknowledged`) > 0);
  await query(`INSERT INTO pipeline_alerts(kind,scope,message) VALUES('pipeline_failed',NULL,'Unrelated')`);
  for (const p of people.slice(0, 8)) await query("UPDATE metric_observations SET observed_at = now() - interval '1 hour' WHERE account_id=$1", [p.account]); // numbers arrive
  const ok = await publishAll();
  assert.equal(ok.rejected.length, 0);
  assert.equal(await n(`SELECT count(*)::int AS n FROM pipeline_alerts WHERE kind='gate_failed' AND NOT acknowledged`), 0);
  assert.equal(await n(`SELECT count(*)::int AS n FROM pipeline_alerts WHERE kind='pipeline_failed' AND NOT acknowledged`), 1);
});


test('daily pipeline catch-up persists one claim per PKT day across concurrent schedulers', async () => {
  const at = new Date('2026-11-28T16:00:00Z');
  assert.equal((await createDailyPipelineRun(new Date('2026-11-28T03:59:59Z'))).reason, 'not_due');
  const claims = await Promise.all(Array.from({length: 6}, () => createDailyPipelineRun(at)));
  assert.equal(claims.filter(r => r.started).length, 1);
  assert.equal(claims.filter(r => r.reason === 'already_recorded').length, 5);
  const id = claims.find(r => r.started)!.id;
  await query("UPDATE pipeline_runs SET status='failed',finished_at=now() WHERE id=$1", [id]);
  assert.equal((await createDailyPipelineRun(new Date('2026-11-28T18:59:59Z'))).reason, 'already_recorded');
  assert.equal(await n("SELECT count(*)::int AS n FROM pipeline_runs WHERE trigger='scheduled'"), 1);
  assert.equal((await createDailyPipelineRun(new Date('2026-11-29T04:00:00Z'))).started, true);
});

test('daily pipeline does not displace an active manual run, and can claim after it ends', async () => {
  const at = new Date('2026-11-28T10:00:00Z');
  const id = (await query("INSERT INTO pipeline_runs(trigger,created_at) VALUES('manual',$1) RETURNING id", [at.toISOString()])).rows[0].id;
  assert.equal((await createDailyPipelineRun(at)).reason, 'busy');
  await query("UPDATE pipeline_runs SET status='succeeded',finished_at=now() WHERE id=$1", [id]);
  assert.equal((await createDailyPipelineRun(at)).started, true);
});
