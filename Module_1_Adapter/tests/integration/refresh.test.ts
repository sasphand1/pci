// Real PostgreSQL *_test database, mocked providers: no network. See .env.test.example.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pool, query } from '../../src/lib/db.js';
import { ensureRegistrySchema } from '../../src/lib/registry-schema.js';
import { ensureObservationsSchema } from '../../src/lib/observations-schema.js';
import { createRuns, processRun, recoverStalledRuns, type Deps } from '../../src/modules/refresh/service.js';
import { runRetention } from '../../src/modules/refresh/retention.js';
import { deletePerson } from '../../src/modules/bucket/service.js';
import { rankScope } from '../../src/engine/index.js';
import type { AccountRef, FetchResult, Platform, Provider } from '../../src/providers/types.js';

if (process.env.NODE_ENV !== 'test' || !/\/[^/]*_test(?:\?|$)/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('Refusing writable integration tests: set NODE_ENV=test and use a separate *_test PostgreSQL database');
}

const calls: number[] = [];
function deps(fn: (accounts: AccountRef[], call: number) => FetchResult[] | Promise<FetchResult[]>, platform: Platform = 'youtube'): Deps {
  let n = 0;
  const provider: Provider = { platform, async fetch(a) { n++; calls.push(n); return fn(a, n); } };
  return { providers: { [platform]: provider }, now: () => new Date(), sleep: async () => {}, backoff: () => 0, background: false };
}
const okRes = (a: AccountRef, followers = 1000, extra: Partial<Record<string, number>> = {}): FetchResult => ({ accountId: a.id, outcome: 'ok', metrics: [
  { metric: 'followers', value: followers, accuracy: 'exact' }, { metric: 'views', value: extra.views ?? 5000, accuracy: 'exact' }, { metric: 'posts_30d', value: extra.posts ?? 3, accuracy: 'exact' }] });

async function seed(n: number, platform: Platform = 'youtube', prefix = 'p') {
  const ids: { person: string; account: string }[] = [];
  for (let i = 0; i < n; i++) {
    const person = (await query(`INSERT INTO people(slug,display_name) VALUES($1,$2) RETURNING id`, [`${prefix}-${i}-${Math.random().toString(36).slice(2, 7)}`, `Person ${prefix}${i}`])).rows[0].id;
    const account = (await query(`INSERT INTO accounts(person_id,platform,external_id,handle) VALUES($1,$2,$3,$4) RETURNING id`, [person, platform, `${prefix}${i}-${Math.random().toString(36).slice(2, 8)}`, `h${prefix}${i}`])).rows[0].id;
    ids.push({ person, account });
  }
  return ids;
}
async function clean() { await query('TRUNCATE people CASCADE'); await query('TRUNCATE refresh_runs CASCADE'); }
const plain = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const count = async (sql: string, v: unknown[] = []) => Number((await query(sql, v)).rows[0].n);

test.before(async () => { await ensureRegistrySchema(); await ensureObservationsSchema(); await clean(); });
test.beforeEach(async () => { await clean(); });
test.after(async () => { await clean(); await pool.end(); });

test('B1 with 5 of 50 accounts failing, the other 45 have observations and the 5 have a result row with the right outcome', async () => {
  const ids = await seed(50);
  const bad = new Set(ids.slice(0, 5).map(i => i.account));
  const [run] = await createRuns(['youtube'], 'manual', null);
  await processRun(run.runId, deps(accts => accts.map(a => bad.has(a.id) ? { accountId: a.id, outcome: 'not_found' as const, metrics: [] } : okRes(a))));
  assert.equal(await count('SELECT count(*)::int AS n FROM refresh_results WHERE run_id=$1', [run.runId]), 50);
  assert.equal(await count(`SELECT count(*)::int AS n FROM refresh_results WHERE run_id=$1 AND outcome='not_found'`, [run.runId]), 5);
  assert.equal(await count('SELECT count(DISTINCT account_id)::int AS n FROM metric_observations WHERE run_id=$1', [run.runId]), 45);
  assert.equal(await count('SELECT count(*)::int AS n FROM metric_observations WHERE run_id=$1', [run.runId]), 135);
  const r = (await query('SELECT status, counts FROM refresh_runs WHERE id=$1', [run.runId])).rows[0];
  assert.equal(r.status, 'partial'); assert.equal(r.counts.ok, 45); assert.equal(r.counts.not_found, 5);
  for (const id of bad) assert.equal(await count('SELECT count(*)::int AS n FROM metric_observations WHERE account_id=$1', [id]), 0);
});
test('retries: an account that errors twice then succeeds ends ok with 3 attempts; one that always errors ends error after exactly 3 attempts', async () => {
  const ids = await seed(2); const flaky = ids[0].account, dead = ids[1].account;
  const seen: Record<string, number> = {};
  const [run] = await createRuns(['youtube'], 'manual', null);
  await processRun(run.runId, deps(accts => accts.map(a => {
    seen[a.id] = (seen[a.id] ?? 0) + 1;
    if (a.id === dead) return { accountId: a.id, outcome: 'error' as const, metrics: [], detail: 'boom' };
    return a.id === flaky && seen[a.id] < 3 ? { accountId: a.id, outcome: 'rate_limited' as const, metrics: [] } : okRes(a);
  })));
  assert.equal(seen[dead], 3); assert.equal(seen[flaky], 3);
  const rows = (await query('SELECT account_id, outcome, attempts FROM refresh_results WHERE run_id=$1', [run.runId])).rows;
  assert.deepEqual(plain(rows.find((r: any) => r.account_id === flaky)), { account_id: flaky, outcome: 'ok', attempts: 3 });
  assert.deepEqual(plain(rows.find((r: any) => r.account_id === dead)), { account_id: dead, outcome: 'error', attempts: 3 });
});
test('final outcomes are not retried: not_found, private, unsupported are asked once', async () => {
  await seed(3); let calls = 0;
  const [run] = await createRuns(['youtube'], 'manual', null);
  await processRun(run.runId, deps(accts => { calls++; return accts.map((a, i) => ({ accountId: a.id, outcome: (['not_found', 'private', 'unsupported'] as const)[i % 3], metrics: [] })); }));
  assert.equal(calls, 1);
});
test('B2 hidden subscriber count creates no followers observation, never zero; bad numbers are never stored', async () => {
  const [a, b] = await seed(2);
  const [run] = await createRuns(['youtube'], 'manual', null);
  await processRun(run.runId, deps(accts => accts.map(x => x.id === a.account
    ? { accountId: x.id, outcome: 'ok' as const, metrics: [{ metric: 'views' as const, value: 700, accuracy: 'exact' as const }], detail: 'followers_hidden' }
    : { accountId: x.id, outcome: 'ok' as const, metrics: [{ metric: 'followers' as const, value: -5, accuracy: 'exact' as const }, { metric: 'views' as const, value: 9, accuracy: 'exact' as const }] })));
  const obs = (await query('SELECT account_id, metric, value::int AS value FROM metric_observations ORDER BY account_id, metric')).rows;
  assert.deepEqual(obs.filter((o: any) => o.account_id === a.account).map((o: any) => [o.metric, o.value]), [['views', 700]]);
  assert.deepEqual(obs.filter((o: any) => o.account_id === b.account).map((o: any) => [o.metric, o.value]), [['views', 9]]);
  assert.equal(await count(`SELECT count(*)::int AS n FROM metric_observations WHERE metric='followers'`), 0);
});
test('B3 a second refresh while one is queued or running is merged, not started; after it finishes a new one can start', async () => {
  await seed(1);
  const [first] = await createRuns(['youtube'], 'manual', null);
  const [second] = await createRuns(['youtube'], 'manual', null);
  assert.equal(first.started, true); assert.equal(second.started, false); assert.equal(second.reason, 'already_running'); assert.equal(second.runId, first.runId);
  await processRun(first.runId, deps(accts => accts.map(a => okRes(a))));
  const [third] = await createRuns(['youtube'], 'manual', null);
  assert.equal(third.started, true); assert.notEqual(third.runId, first.runId);
  assert.equal(await count('SELECT count(*)::int AS n FROM refresh_runs'), 2);
  await assert.rejects(query(`INSERT INTO refresh_runs(platform,trigger,status) VALUES('youtube','manual','queued')`), /refresh_runs_one_active_per_platform/); // the database itself refuses
});
test('processing the same run twice at once does the work once', async () => {
  await seed(3); let fetches = 0;
  const [run] = await createRuns(['youtube'], 'manual', null);
  const d = deps(async accts => { fetches++; await new Promise(r => setTimeout(r, 30)); return accts.map(a => okRes(a)); });
  await Promise.all([processRun(run.runId, d), processRun(run.runId, d)]);
  assert.equal(fetches, 1); assert.equal(await count('SELECT count(*)::int AS n FROM refresh_results WHERE run_id=$1', [run.runId]), 3);
});
test('B4 a run left running by a killed worker is marked failed on recovery, and a new run completes', async () => {
  await seed(2);
  await query(`INSERT INTO refresh_runs(platform,trigger,status,started_at,heartbeat_at) VALUES('youtube','manual','running', now()-interval '40 minutes', now()-interval '30 minutes')`);
  const [blocked] = await createRuns(['youtube'], 'manual', null); // createRuns recovers first, so the dead run does not block
  assert.equal(blocked.started, true);
  const dead = (await query(`SELECT status, error FROM refresh_runs WHERE id<>$1`, [blocked.runId])).rows;
  assert.deepEqual(plain(dead), [{ status: 'failed', error: 'stalled' }]);
  await processRun(blocked.runId, deps(accts => accts.map(a => okRes(a))));
  assert.equal((await query('SELECT status FROM refresh_runs WHERE id=$1', [blocked.runId])).rows[0].status, 'succeeded');
});
test('recovery leaves a healthy running run alone and also fails a queued run nobody picked up', async () => {
  await query(`INSERT INTO refresh_runs(platform,trigger,status,started_at,heartbeat_at) VALUES('youtube','manual','running', now(), now()-interval '2 minutes')`);
  await query(`INSERT INTO refresh_runs(platform,trigger,status,created_at) VALUES('instagram','manual','queued', now()-interval '25 minutes')`);
  assert.equal(await recoverStalledRuns(), 1);
  assert.deepEqual(plain((await query('SELECT platform, status FROM refresh_runs ORDER BY platform')).rows), [{ platform: 'instagram', status: 'failed' }, { platform: 'youtube', status: 'running' }]);
});
test('a provider that throws fails every account for that attempt, never the whole server; the run ends failed', async () => {
  await seed(3);
  const [run] = await createRuns(['youtube'], 'manual', null);
  await processRun(run.runId, deps(() => { throw new Error('YOUTUBE_API_KEY not configured'); }));
  const r = (await query('SELECT status FROM refresh_runs WHERE id=$1', [run.runId])).rows[0];
  assert.equal(r.status, 'failed'); assert.equal(await count(`SELECT count(*)::int AS n FROM refresh_results WHERE run_id=$1 AND outcome='error'`, [run.runId]), 3);
  assert.equal(await count('SELECT count(*)::int AS n FROM metric_observations'), 0);
});
test('a provider that returns too few results leaves no account without a result row', async () => {
  const ids = await seed(4);
  const [run] = await createRuns(['youtube'], 'manual', null);
  await processRun(run.runId, deps(accts => accts.slice(0, 2).map(a => okRes(a))));
  assert.equal(await count('SELECT count(*)::int AS n FROM refresh_results WHERE run_id=$1', [run.runId]), ids.length);
});
test('an account deleted while a run is in flight is skipped quietly and the run still finishes', async () => {
  const ids = await seed(3);
  const [run] = await createRuns(['youtube'], 'manual', null);
  await processRun(run.runId, deps(async accts => { await deletePerson(ids[0].person, null); return accts.map(a => okRes(a)); }));
  assert.equal(await count('SELECT count(*)::int AS n FROM metric_observations WHERE account_id=$1', [ids[0].account]), 0);
  assert.equal(await count('SELECT count(*)::int AS n FROM refresh_results WHERE account_id=$1', [ids[0].account]), 0);
  assert.notEqual((await query('SELECT status FROM refresh_runs WHERE id=$1', [run.runId])).rows[0].status, 'running');
});
test('hard delete leaves no observations or refresh results for that person', async () => {
  const ids = await seed(2);
  const [run] = await createRuns(['youtube'], 'manual', null);
  await processRun(run.runId, deps(accts => accts.map(a => okRes(a))));
  assert.ok(await count('SELECT count(*)::int AS n FROM metric_observations WHERE account_id=$1', [ids[0].account]) > 0);
  await deletePerson(ids[0].person, null);
  for (const t of ['metric_observations', 'refresh_results']) assert.equal(await count(`SELECT count(*)::int AS n FROM ${t} WHERE account_id=$1`, [ids[0].account]), 0, t);
  assert.ok(await count('SELECT count(*)::int AS n FROM metric_observations WHERE account_id=$1', [ids[1].account]) > 0); // others untouched
});
test('Instagram placeholder ids are replaced once the real id is learned; a clash is skipped without failing the run', async () => {
  const [a, b] = await seed(2, 'instagram', 'ig');
  await query(`UPDATE accounts SET external_id='pending:one' WHERE id=$1`, [a.account]);
  await query(`UPDATE accounts SET external_id='pending:two' WHERE id=$1`, [b.account]);
  await query(`INSERT INTO people(slug,display_name) VALUES('squatter','Squatter')`);
  await query(`INSERT INTO accounts(person_id,platform,external_id,handle) SELECT id,'instagram','999','sq' FROM people WHERE slug='squatter'`);
  const [run] = await createRuns(['instagram'], 'manual', null);
  await processRun(run.runId, deps(accts => accts.filter(x => x.externalId.startsWith('pending:')).map(x => ({ ...okRes(x), resolvedExternalId: x.id === a.account ? '555' : '999' })), 'instagram'));
  assert.equal((await query('SELECT external_id FROM accounts WHERE id=$1', [a.account])).rows[0].external_id, '555');
  assert.equal((await query('SELECT external_id FROM accounts WHERE id=$1', [b.account])).rows[0].external_id, 'pending:two');
  assert.equal(await count(`SELECT count(*)::int AS n FROM metric_observations WHERE account_id=$1`, [b.account]), 3 - 1); // followers + posts_30d only: Instagram has no views, so that one is dropped
});
test('retention removes only observations older than the platform limit', async () => {
  const [y] = await seed(1, 'youtube', 'ry'); const [i] = await seed(1, 'instagram', 'ri');
  const ins = (acc: string, days: number) => query(`INSERT INTO metric_observations(account_id,metric,value,observed_at) VALUES($1,'followers',1, now()-make_interval(days=>$2))`, [acc, days]);
  await ins(y.account, 100); await ins(y.account, 5); await ins(i.account, 40); await ins(i.account, 5);
  const out = await runRetention({ PCI_RETENTION_DAYS_INSTAGRAM: '30' });
  assert.deepEqual(out, { youtube: 1, instagram: 1 });
  assert.equal(await count('SELECT count(*)::int AS n FROM metric_observations'), 2);
});
test('refresh audit rows hold counts only', async () => {
  await seed(1);
  await createRuns(['youtube', 'instagram'], 'manual', null);
  const rows = (await query(`SELECT metadata::text AS m FROM admin_audit_logs WHERE action='refresh.start'`)).rows;
  assert.ok(rows.length >= 1); for (const r of rows) assert.ok(!/h[a-z]*\d|Person/.test(String(r.m)), r.m);
});
test('end to end: refreshed observations feed the pure ranking core and give the expected order', async () => {
  const ids = await seed(3);
  const values = [300, 900, 600];
  const [run] = await createRuns(['youtube'], 'manual', null);
  await processRun(run.runId, deps(accts => accts.map(a => okRes(a, values[ids.findIndex(i => i.account === a.id)]))));
  const people = (await query(`SELECT p.id, p.created_at, json_agg(json_build_object('id',a.id,'platform',a.platform)) AS accounts FROM people p JOIN accounts a ON a.person_id=p.id GROUP BY p.id`)).rows
    .map((p: any) => ({ id: p.id, createdAt: new Date(p.created_at).toISOString(), accounts: p.accounts, categories: [] }));
  const observations = (await query(`SELECT account_id, metric, value::bigint::text AS value, observed_at, accuracy FROM metric_observations`)).rows
    .map((o: any) => ({ accountId: o.account_id, metric: o.metric, value: Number(o.value), observedAt: new Date(o.observed_at).toISOString(), accuracy: o.accuracy }));
  const r = rankScope('wheel.subscribed', { now: new Date().toISOString(), people, observations });
  assert.deepEqual(r.entries.map(e => e.value), [900, 600, 300]); assert.equal(r.entries[0].personId, ids[1].person); assert.equal(r.unranked.length, 0);
});
