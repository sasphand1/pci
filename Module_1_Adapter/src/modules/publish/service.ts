import { randomUUID } from 'node:crypto';
import {centralTikTokMode,loadTikTokRankInput,TIKTOK_SCOPES} from '../creators-bucket/tiktok-central.js';
import { query, transaction } from '../../lib/db.js';
import { HttpError, logger } from '../../lib/errors.js';
import { FIXED_SCOPES, FRESHNESS_DAYS_DEFAULT, rankScope, removePerson, type Entry, type RankInput, type RankResult, type Unranked } from '../../engine/index.js';
import { diffRankings, type RankDiff } from './diff.js';
import { minCoverageFrom, runGates, type GateFailure } from './gates.js';

export type Db = { query: (sql: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> };
const poolDb: Db = { query: (s, v) => query(s, v) };
type Trigger = 'manual' | 'scheduled' | 'system';
if (process.env.PCI_INGEST_RANKING === 'false') logger.warn('PCI_INGEST_RANKING=false: rankings read the legacy metric table instead of the hub');

// ---------- loading ----------
export async function loadRankInput(db: Db, now: Date, freshnessDays = FRESHNESS_DAYS_DEFAULT): Promise<RankInput> {
  const since = new Date(now.getTime() - freshnessDays * 86_400_000).toISOString();
  const until = new Date(now.getTime() + 5 * 60_000).toISOString();
  const [people, accounts, cats, obs] = await Promise.all([
    db.query('SELECT id, created_at FROM people'),
    db.query('SELECT id, person_id, platform FROM accounts'),
    db.query('SELECT pc.person_id, c.slug FROM person_categories pc JOIN categories c ON c.id=pc.category_id'),
    // Newest hub value per account and metric inside the freshness window (same rule the engine applies).
    // The hub is the ranking input. PCI_INGEST_RANKING=false is an explicit, logged rollback to the old table.
    db.query(process.env.PCI_INGEST_RANKING!=='false'
      ? `SELECT a.id AS account_id,l.metric,l.value_numeric::text AS value,
           CASE WHEN l.accuracy='rounded' THEN 'rounded3' ELSE 'exact' END AS accuracy,l.observed_at
         FROM ingest_latest l JOIN accounts a
           ON l.entity_kind='account' AND l.entity_id=a.platform||':'||a.external_id
         WHERE l.metric IN ('followers','views','posts_30d') AND l.value_numeric IS NOT NULL
           AND l.accuracy<>'unverified' AND l.observed_at >= $1 AND l.observed_at <= $2`
      : `SELECT DISTINCT ON (account_id, metric) account_id, metric, value::text AS value, accuracy, observed_at
              FROM metric_observations WHERE observed_at >= $1 AND observed_at <= $2
              ORDER BY account_id, metric, observed_at DESC, value DESC`, [since, until])
  ]);
  const accBy = new Map<string, { id: string; platform: any }[]>(), catBy = new Map<string, string[]>();
  for (const a of accounts.rows) { const l = accBy.get(a.person_id) ?? []; l.push({ id: a.id, platform: a.platform }); accBy.set(a.person_id, l); }
  for (const c of cats.rows) { const l = catBy.get(c.person_id) ?? []; l.push(c.slug); catBy.set(c.person_id, l); }
  return {
    now: now.toISOString(), freshnessDays,
    people: people.rows.map(p => ({ id: p.id, createdAt: new Date(p.created_at).toISOString(), accounts: accBy.get(p.id) ?? [], categories: catBy.get(p.id) ?? [] })),
    observations: obs.rows.map(o => ({ accountId: o.account_id, metric: o.metric, value: Number(o.value), observedAt: new Date(o.observed_at).toISOString(), accuracy: o.accuracy }))
  };
}

/** The five fixed scopes plus one per category that has at least one person. */
export function scopesFor(input: RankInput): string[] {
  const cats = new Set<string>();
  for (const p of input.people) for (const c of p.categories) cats.add(c);
  return [...FIXED_SCOPES, ...[...cats].sort().map(c => `category.${c}`)];
}

// ---------- storing and reading runs ----------
async function insertRun(db: Db, r: RankResult, m: { batchId: string; trigger: Trigger; actorId: string | null; now: Date; freshnessDays: number; failures: GateFailure[] }): Promise<string> {
  const diagnostics = { population: r.population, covered: r.covered, unranked: r.unranked, freshnessDays: m.freshnessDays, asOf: m.now.toISOString(), gateFailures: m.failures };
  const id = (await db.query('INSERT INTO rank_runs(batch_id,scope,policy_version,input_hash,status,trigger,created_by,diagnostics) VALUES($1,$2,$3,$4,\'draft\',$5,$6,$7::jsonb) RETURNING id',
    [m.batchId, r.scope, r.policyVersion, r.inputHash, m.trigger, m.actorId, JSON.stringify(diagnostics)])).rows[0].id as string;
  if(r.entries.length)await db.query(
    'INSERT INTO rank_slots(run_id,slot,rank,person_id,value,breakdown) SELECT $1::uuid,x.slot,x.rank,x.person_id,x.value,x.breakdown FROM jsonb_to_recordset($2::jsonb) AS x(slot integer,rank integer,person_id uuid,value bigint,breakdown jsonb)',
    [id,JSON.stringify(r.entries.map(e=>({slot:e.slot,rank:e.rank,person_id:e.personId,value:String(e.value),breakdown:{linked:e.linked,counted:e.counted,contributions:e.breakdown}})))]);
  return id;
}

export async function loadRunResult(db: Db, runId: string): Promise<RankResult & { status: string; publishedAt: string | null; createdAt: string; trigger: string; gateFailures: GateFailure[] }> {
  const run = (await db.query('SELECT scope, policy_version, input_hash, status, trigger, created_at, published_at, diagnostics FROM rank_runs WHERE id=$1', [runId])).rows[0];
  if (!run) throw new HttpError(404, 'NOT_FOUND', 'Ranking run not found');
  const slots = (await db.query('SELECT slot, rank, person_id, value::text AS value, breakdown FROM rank_slots WHERE run_id=$1 ORDER BY slot', [runId])).rows;
  const entries: Entry[] = slots.map(s => ({ slot: s.slot, rank: s.rank, personId: s.person_id, value: Number(s.value), counted: s.breakdown.counted, linked: s.breakdown.linked, breakdown: s.breakdown.contributions }));
  const d = run.diagnostics ?? {};
  return { scope: run.scope, policyVersion: run.policy_version, inputHash: run.input_hash, population: d.population ?? entries.length, covered: entries.length, entries, unranked: (d.unranked ?? []) as Unranked[],
    status: run.status, publishedAt: run.published_at ? new Date(run.published_at).toISOString() : null, createdAt: new Date(run.created_at).toISOString(), trigger: run.trigger, gateFailures: d.gateFailures ?? [] };
}

async function liveSlots(db: Db): Promise<Map<string, { personId: string; slot: number; value: number }[]>> {
  const rows = (await db.query('SELECT p.scope, rs.slot, rs.person_id, rs.value::text AS value FROM published_pointers p JOIN rank_slots rs ON rs.run_id=p.run_id ORDER BY p.scope, rs.slot')).rows;
  const m = new Map<string, { personId: string; slot: number; value: number }[]>();
  for (const r of rows) { const l = m.get(r.scope) ?? []; l.push({ personId: r.person_id, slot: r.slot, value: Number(r.value) }); m.set(r.scope, l); }
  return m;
}

async function activate(db: Db, runId: string, scope: string): Promise<void> {
  await db.query("UPDATE rank_runs SET status='superseded' WHERE id=(SELECT run_id FROM published_pointers WHERE scope=$1) AND status='published' AND id<>$2", [scope, runId]);
  await db.query("UPDATE rank_runs SET status='published', published_at=now() WHERE id=$1", [runId]);
  await db.query('INSERT INTO published_pointers(scope,run_id) VALUES($1,$2) ON CONFLICT (scope) DO UPDATE SET run_id=EXCLUDED.run_id, updated_at=now()', [scope, runId]);
}
async function alert(db: Db, kind: string, scope: string | null, message: string, runId: string | null) {
  await db.query('INSERT INTO pipeline_alerts(kind,scope,message,run_id) VALUES($1,$2,$3,$4)', [kind, scope, message.slice(0, 500), runId]);
}
const knownIds = async (db: Db) => new Set<string>((await db.query('SELECT id FROM people')).rows.map(r => r.id));

// ---------- Rank (build drafts) ----------
export async function buildBatch(trigger: Trigger, actorId: string | null, opts: { now?: Date; freshnessDays?: number } = {}) {
  const now = opts.now ?? new Date(), freshness = opts.freshnessDays ?? FRESHNESS_DAYS_DEFAULT;
  const minCoverage = minCoverageFrom();
  const batchId = randomUUID();
  return transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(710325)');
    const input=await loadRankInput(client,now,freshness);
    const tiktok=centralTikTokMode()!=='off'?await loadTikTokRankInput(client,now):null;
    const known=new Set([...input.people,...(tiktok?.people??[])].map(p=>p.id));
    const live = await liveSlots(client);
    const drafts: { runId: string; scope: string; population: number; covered: number; gateFailures: GateFailure[] }[] = [];
    for (const scope of [...scopesFor(input),...(tiktok?TIKTOK_SCOPES:[])]) {
      const scopeInput=scope.startsWith('tiktok.')&&tiktok?tiktok:input;
      const result = rankScope(scope, scopeInput);
      if (result.population === 0 && !live.has(scope)) continue;
      const failures = runGates(result, { knownPersonIds: known, minCoverage, checkCoverage: true });
      const runId = await insertRun(client, result, { batchId, trigger, actorId, now, freshnessDays: scopeInput.freshnessDays??freshness, failures });
      drafts.push({ runId, scope, population: result.population, covered: result.covered, gateFailures: failures });
    }
    await client.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,NULL,$3::jsonb)', [actorId, 'rank.build', JSON.stringify({ trigger, scopes: drafts.length })]);
    return { batchId, drafts };
  });
}

async function namesFor(db: Db, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  return new Map((await db.query('SELECT id, display_name FROM people WHERE id=ANY($1::uuid[])', [ids])).rows.map(r => [r.id, r.display_name]));
}

/** A batch for review: per scope the status, gate result, and what would change against the live ranking. */
export async function getBatch(batchId: string, topN = 15) {
  const runs = (await poolDb.query('SELECT id FROM rank_runs WHERE batch_id=$1 ORDER BY scope', [batchId])).rows;
  if (!runs.length) throw new HttpError(404, 'NOT_FOUND', 'Batch not found');
  const live = await liveSlots(poolDb);
  const loaded = [];
  for (const r of runs) loaded.push(await loadRunResult(poolDb, r.id));
  const diffs = loaded.map(l => diffRankings(live.get(l.scope) ?? null, l.entries.map(e => ({ personId: e.personId, slot: e.slot, value: e.value }))));
  const ids = new Set<string>();
  loaded.forEach((l, i) => { l.entries.slice(0, topN).forEach(e => ids.add(e.personId)); const d = diffs[i]; d.entered.slice(0, 20).forEach(x => ids.add(x.personId)); d.left.slice(0, 20).forEach(x => ids.add(x.personId)); d.moved.slice(0, 20).forEach(x => ids.add(x.personId)); });
  const names = await namesFor(poolDb, [...ids]);
  const nm = (id: string) => names.get(id) ?? 'Unknown';
  return {
    batchId,
    scopes: loaded.map((l, i) => {
      const d: RankDiff = diffs[i];
      return { runId: runs[i].id, scope: l.scope, status: l.status, trigger: l.trigger, createdAt: l.createdAt, population: l.population, covered: l.covered, unranked: l.unranked.length, gateFailures: l.gateFailures, hasLive: live.has(l.scope),
        top: l.entries.slice(0, topN).map(e => ({ slot: e.slot, rank: e.rank, personId: e.personId, displayName: nm(e.personId), value: e.value, counted: e.counted, linked: e.linked })),
        diff: { entered: d.entered.slice(0, 20).map(x => ({ ...x, displayName: nm(x.personId) })), left: d.left.slice(0, 20).map(x => ({ ...x, displayName: nm(x.personId) })), moved: d.moved.slice(0, 20).map(x => ({ ...x, displayName: nm(x.personId) })),
          counts: { entered: d.entered.length, left: d.left.length, moved: d.moved.length, valueChanged: d.valueChanged, unchanged: d.unchanged } } };
    })
  };
}
export async function latestBatchId(): Promise<string | null> {
  return (await poolDb.query("SELECT batch_id FROM rank_runs WHERE trigger<>'system' ORDER BY created_at DESC LIMIT 1")).rows[0]?.batch_id ?? null;
}

// ---------- Publish ----------
/** Publishes every draft of the batch that passes all gates, in ONE transaction. A draft that fails stays out,
 * is marked rejected and raises an alert; the live ranking of that scope does not change. */
export async function publishBatch(batchId: string, actorId: string | null) {
  return transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(710325)');
    const drafts = (await client.query("SELECT id, scope FROM rank_runs WHERE batch_id=$1 AND status='draft' ORDER BY scope FOR UPDATE", [batchId])).rows;
    if (!drafts.length) throw new HttpError(409, 'NOTHING_TO_PUBLISH', 'This batch has no drafts left to publish');
    const known = await knownIds(client), minCoverage = minCoverageFrom();
    const published: string[] = [], rejected: { scope: string; failures: GateFailure[] }[] = [];
    for (const d of drafts) {
      const result = await loadRunResult(client, d.id);
      const failures = runGates(result, { knownPersonIds: known, minCoverage, checkCoverage: true });
      if (failures.length) {
        await client.query("UPDATE rank_runs SET status='rejected', diagnostics = diagnostics || jsonb_build_object('gateFailures', $2::jsonb) WHERE id=$1", [d.id, JSON.stringify(failures)]);
        await alert(client, 'gate_failed', d.scope, `${d.scope}: ${failures[0].message}`, d.id);
        rejected.push({ scope: d.scope, failures });
      } else {
        await activate(client, d.id, d.scope); published.push(d.scope);
        // The problem this alert reported is over for this ranking.
        await client.query("UPDATE pipeline_alerts SET acknowledged=true WHERE scope=$1 AND NOT acknowledged AND kind='gate_failed'", [d.scope]);
      }
    }
    await client.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,NULL,$3::jsonb)', [actorId, 'rank.publish', JSON.stringify({ published: published.length, rejected: rejected.length })]);
    return { published, rejected };
  });
}

export async function rollbackScope(scope: string, actorId: string | null) {
  return transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(710325)');
    const cur = (await client.query('SELECT run_id FROM published_pointers WHERE scope=$1 FOR UPDATE', [scope])).rows[0];
    if (!cur) throw new HttpError(404, 'NOT_FOUND', 'Nothing is published for this scope');
    const prev = (await client.query("SELECT id FROM rank_runs WHERE scope=$1 AND status='superseded' AND published_at IS NOT NULL AND id<>$2 ORDER BY published_at DESC, created_at DESC LIMIT 1", [scope, cur.run_id])).rows[0];
    if (!prev) throw new HttpError(409, 'NOTHING_TO_ROLL_BACK', 'There is no earlier published ranking for this scope');
    const result = await loadRunResult(client, prev.id);
    const failures = runGates(result, { knownPersonIds: await knownIds(client), minCoverage: 0, checkCoverage: false });
    if (failures.length) throw new HttpError(409, 'ROLLBACK_INVALID', `The earlier ranking is no longer valid: ${failures[0].message}`);
    await client.query("UPDATE rank_runs SET status='superseded' WHERE id=$1", [cur.run_id]);
    await client.query("UPDATE rank_runs SET status='published', published_at=now() WHERE id=$1", [prev.id]);
    await client.query('UPDATE published_pointers SET run_id=$2, updated_at=now() WHERE scope=$1', [scope, prev.id]);
    await client.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)', [actorId, 'rank.rollback', scope, JSON.stringify({ scope })]);
    return { scope, runId: prev.id as string };
  });
}

// ---------- Hard delete support (called inside the delete transaction) ----------
export type Captured = Map<string, RankResult>;
export async function captureLive(db: Db): Promise<Captured> {
  const out: Captured = new Map();
  if (((await db.query("SELECT to_regclass('public.published_pointers') AS r")).rows[0].r) === null) return out;
  for (const p of (await db.query('SELECT scope, run_id FROM published_pointers')).rows) out.set(p.scope, await loadRunResult(db, p.run_id));
  return out;
}
/** After the person is gone: every live ranking that contained them is replaced, in the same transaction,
 * by the same ranking without them. Everyone else keeps their value; slots and ranks close up. */
export async function republishWithout(db: Db, captured: Captured, personId: string, actorId: string | null): Promise<number> {
  const known = await knownIds(db);
  let n = 0;
  for (const [scope, result] of captured) {
    if (!result.entries.some(e => e.personId === personId) && !result.unranked.some(u => u.personId === personId)) continue;
    const next = removePerson(result, personId);
    const failures = runGates(next, { knownPersonIds: known, minCoverage: 0, checkCoverage: false });
    if (failures.length) throw new Error(`Republish after delete failed for ${scope}: ${failures[0].message}`);
    const runId = await insertRun(db, next, { batchId: randomUUID(), trigger: 'system', actorId, now: new Date(), freshnessDays: FRESHNESS_DAYS_DEFAULT, failures: [] });
    await activate(db, runId, scope);
    n++;
  }
  return n;
}

// ---------- Reading for admins and status ----------
export async function listPublications() {
  return (await poolDb.query(`SELECT p.scope, p.run_id AS "runId", r.published_at AS "publishedAt", r.policy_version AS "policyVersion",
      (r.diagnostics->>'population')::int AS population, (SELECT count(*)::int FROM rank_slots s WHERE s.run_id=r.id) AS covered
    FROM published_pointers p JOIN rank_runs r ON r.id=p.run_id ORDER BY p.scope`)).rows;
}
export async function getPublication(scope: string, limit = 100) {
  const ptr = (await poolDb.query('SELECT run_id FROM published_pointers WHERE scope=$1', [scope])).rows[0];
  if (!ptr) throw new HttpError(404, 'NOT_FOUND', 'Nothing is published for this scope');
  const r = await loadRunResult(poolDb, ptr.run_id);
  const names = await namesFor(poolDb, [...r.entries.slice(0, limit).map(e => e.personId), ...r.unranked.map(u => u.personId)]);
  const nm = (id: string) => names.get(id) ?? 'Unknown';
  return { scope, runId: ptr.run_id, publishedAt: r.publishedAt, policyVersion: r.policyVersion, population: r.population, covered: r.covered,
    entries: r.entries.slice(0, limit).map(e => ({ slot: e.slot, rank: e.rank, personId: e.personId, displayName: nm(e.personId), value: e.value, counted: e.counted, linked: e.linked })),
    unranked: r.unranked.map(u => ({ personId: u.personId, displayName: nm(u.personId), reason: u.reason, linked: u.linked })) };
}

export async function pruneRankRuns(keepPerScope = 30): Promise<number> {
  const r = await poolDb.query(`DELETE FROM rank_runs r WHERE r.status <> 'published' AND NOT EXISTS (SELECT 1 FROM published_pointers p WHERE p.run_id=r.id)
    AND (SELECT count(*) FROM rank_runs r2 WHERE r2.scope=r.scope AND r2.created_at > r.created_at) >= $1`, [keepPerScope]);
  await poolDb.query("DELETE FROM pipeline_alerts WHERE acknowledged AND created_at < now() - interval '90 days'");
  return r.rowCount ?? 0;
}
/** Refresh runs that are queued or running. Ranking while any exist would judge people on numbers that are still arriving. */
export async function activeRefreshCount(db: Db = poolDb): Promise<number> {
  return (await db.query("SELECT count(*)::int AS n FROM refresh_runs WHERE status IN ('queued','running')")).rows[0].n as number;
}
export const recordAlert = (kind: string, scope: string | null, message: string) => alert(poolDb, kind, scope, message, null);
