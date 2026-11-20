import { query, transaction } from '../../lib/db.js';
import { logger } from '../../lib/errors.js';
import { defaultProviders, type ProviderMap } from '../../providers/index.js';
import type { AccountRef, FetchResult, Outcome, Platform } from '../../providers/types.js';
import { MAX_ATTEMPTS, backoffMs, isRetryable, normalizeResults, summarizeRun } from './normalize.js';

export type Deps = { providers: ProviderMap; now: () => Date; sleep: (ms: number) => Promise<void>; backoff: (attempt: number) => number; background: boolean };
const realDeps = (): Deps => ({ providers: defaultProviders(), now: () => new Date(), sleep: ms => new Promise(r => setTimeout(r, ms)), backoff: backoffMs, background: true });
export const ENABLED_PLATFORMS: Platform[] = ['youtube', 'instagram'];
const CHUNK: Record<string, number> = { youtube: 50, instagram: 10 };
export const STALL_MINUTES = 20;

export type StartedRun = { platform: Platform; runId: string; started: boolean; reason?: 'already_running' };

/** Marks queued/running runs with no heartbeat for 20 minutes as failed, so a crashed worker never blocks refreshes. */
export async function recoverStalledRuns(minutes = STALL_MINUTES): Promise<number> {
  const r = await query(
    `UPDATE refresh_runs SET status='failed', finished_at=now(), error='stalled'
     WHERE status IN ('queued','running') AND COALESCE(heartbeat_at, created_at) < now() - make_interval(mins => $1) RETURNING id`, [minutes]);
  return r.rowCount ?? 0;
}

/** Creates one run per platform. A platform with a run already queued or running is not started twice. */
export async function createRuns(platforms: Platform[], trigger: 'manual' | 'scheduled' | 'system', actorId: string | null): Promise<StartedRun[]> {
  await recoverStalledRuns();
  const out: StartedRun[] = [];
  for (const platform of [...new Set(platforms)].filter(p => ENABLED_PLATFORMS.includes(p))) {
    try {
      const r = await query<{ id: string }>('INSERT INTO refresh_runs(platform,trigger,created_by) VALUES($1,$2,$3) RETURNING id', [platform, trigger, actorId]);
      out.push({ platform, runId: r.rows[0].id, started: true });
    } catch (e: any) {
      if (e?.code !== '23505') throw e;
      const existing = await query<{ id: string }>("SELECT id FROM refresh_runs WHERE platform=$1 AND status IN ('queued','running') ORDER BY created_at DESC LIMIT 1", [platform]);
      out.push({ platform, runId: existing.rows[0]?.id ?? '', started: false, reason: 'already_running' });
    }
  }
  await query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,NULL,$3::jsonb)', [actorId, 'refresh.start', JSON.stringify({ trigger, requested: platforms.length, started: out.filter(o => o.started).length })]);
  return out;
}

/** Create and (by default) start processing in the background. */
export async function startRefresh(platforms: Platform[], trigger: 'manual' | 'scheduled' | 'system', actorId: string | null, deps: Deps = realDeps()): Promise<StartedRun[]> {
  const runs = await createRuns(platforms, trigger, actorId);
  if (deps.background) for (const r of runs) if (r.started) setImmediate(() => { processRun(r.runId, deps).catch(err => logger.error({ err, runId: r.runId }, 'refresh run crashed')); });
  return runs;
}

async function heartbeat(runId: string) { await query('UPDATE refresh_runs SET heartbeat_at=now() WHERE id=$1', [runId]); }

async function persist(runId: string, result: FetchResult, attempts: number, observedAt: Date): Promise<void> {
  await transaction(async c => {
    // Skip silently if the person was deleted while the run was in flight.
    const alive = await c.query('SELECT external_id FROM accounts WHERE id=$1 FOR SHARE', [result.accountId]);
    if (!alive.rowCount) return;
    await c.query('INSERT INTO refresh_results(run_id,account_id,outcome,attempts,detail) VALUES($1,$2,$3,$4,$5) ON CONFLICT (run_id,account_id) DO NOTHING',
      [runId, result.accountId, result.outcome, attempts, result.detail ?? null]);
    if (result.outcome === 'ok') for (const m of result.metrics)
      await c.query('INSERT INTO metric_observations(account_id,metric,value,accuracy,capped,observed_at,run_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (account_id,metric,run_id) DO NOTHING',
        [result.accountId, m.metric, m.value, m.accuracy, m.capped === true, observedAt.toISOString(), runId]);
    if (result.resolvedExternalId && String(alive.rows[0].external_id).startsWith('pending:')) {
      await c.query('SAVEPOINT resolve');
      try { await c.query("UPDATE accounts SET external_id=$1 WHERE id=$2 AND external_id LIKE 'pending:%'", [result.resolvedExternalId, result.accountId]); await c.query('RELEASE SAVEPOINT resolve'); }
      catch (e: any) { await c.query('ROLLBACK TO SAVEPOINT resolve'); if (e?.code !== '23505') throw e; }
    }
  });
}

/** Runs one queued run to the end. Never throws for a single bad account; a crash marks the run failed. */
export async function processRun(runId: string, deps: Deps = realDeps()): Promise<void> {
  const claimed = await query<{ platform: Platform }>("UPDATE refresh_runs SET status='running', started_at=now(), heartbeat_at=now() WHERE id=$1 AND status='queued' RETURNING platform", [runId]);
  if (!claimed.rowCount) return;
  const platform = claimed.rows[0].platform;
  try {
    const provider = deps.providers[platform];
    if (!provider) throw new Error(`No provider for ${platform}`);
    const rows = await query<{ id: string; external_id: string; handle: string }>('SELECT id, external_id, handle FROM accounts WHERE platform=$1 ORDER BY id', [platform]);
    const all: AccountRef[] = rows.rows.map(r => ({ id: r.id, platform, externalId: r.external_id, handle: r.handle }));
    const counts: Partial<Record<Outcome, number>> = {};
    let pending = all;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && pending.length; attempt++) {
      const retry: AccountRef[] = [];
      const size = CHUNK[platform] ?? 10;
      for (let i = 0; i < pending.length; i += size) {
        const chunk = pending.slice(i, i + size);
        await heartbeat(runId);
        let raw: FetchResult[];
        try { raw = await provider.fetch(chunk); }
        catch (e) { raw = chunk.map(a => ({ accountId: a.id, outcome: 'error' as const, metrics: [], detail: (e instanceof Error ? e.message : 'provider_failed').slice(0, 120) })); }
        const results = normalizeResults(chunk, raw);
        for (let j = 0; j < results.length; j++) {
          const r = results[j];
          if (isRetryable(r.outcome) && attempt < MAX_ATTEMPTS) { retry.push(chunk[j]); continue; }
          await persist(runId, r, attempt, deps.now());
          counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;
        }
      }
      pending = retry;
      if (pending.length) await deps.sleep(deps.backoff(attempt));
    }
    const status = summarizeRun(all.length, counts);
    await query('UPDATE refresh_runs SET status=$2, finished_at=now(), counts=$3::jsonb WHERE id=$1 AND status=\'running\'', [runId, status, JSON.stringify({ accounts: all.length, ...counts })]);
  } catch (e) {
    logger.error({ err: e, runId }, 'refresh run failed');
    await query("UPDATE refresh_runs SET status='failed', finished_at=now(), error=$2 WHERE id=$1 AND status='running'", [runId, (e instanceof Error ? e.message : 'failed').slice(0, 200)]);
  }
}

export async function listRuns(limit = 20) {
  return (await query('SELECT id, platform, trigger, status, created_at AS "createdAt", started_at AS "startedAt", finished_at AS "finishedAt", counts, error FROM refresh_runs ORDER BY created_at DESC LIMIT $1', [limit])).rows;
}
export async function getRun(id: string) {
  const run = (await query('SELECT id, platform, trigger, status, created_at AS "createdAt", started_at AS "startedAt", finished_at AS "finishedAt", counts, error FROM refresh_runs WHERE id=$1', [id])).rows[0];
  if (!run) return null;
  const results = (await query(`SELECT r.account_id AS "accountId", a.platform, a.handle, r.outcome, r.attempts, r.detail
    FROM refresh_results r JOIN accounts a ON a.id=r.account_id WHERE r.run_id=$1 ORDER BY r.outcome, a.handle LIMIT 500`, [id])).rows;
  return { ...run, results };
}
