import { pool, query } from '../../lib/db.js';
import { logger } from '../../lib/errors.js';
import { fetchGraphInstagramAvatar, type GraphAvatarProbe } from '../../providers/instagram-avatar.js';
import { recordObservation } from './store.js';
import { reportSourceResult } from './monitor.js';
import { GRAPH_AVATAR_RUN_LIMIT, graphAvatarNextAllowedAt, type GraphAvatarGate } from './graph-avatar-policy.js';

export type GraphAvatarFill = {
  status: 'done' | 'skipped';
  reason?: string;
  nextEligibleAt?: string;
  tried: number;
  filled: number;
  missing: number;
  rejected: number;
  unsupported: number;
  failed: number;
  stoppedEarly: boolean;
};
const skip = (reason: string, nextEligibleAt?: string): GraphAvatarFill => ({
  status: 'skipped', reason, ...(nextEligibleAt ? { nextEligibleAt } : {}),
  tried: 0, filled: 0, missing: 0, rejected: 0, unsupported: 0, failed: 0, stoppedEarly: false,
});
type Dependencies = {
  probe?: (handle: string) => Promise<GraphAvatarProbe>;
  sleep?: (milliseconds: number) => Promise<void>;
};

/** Recovers ONLY absent pictures through authorized Meta Business Discovery.
 * No public-page scraping, no ranking changes, no YouTube work, no token logging.
 * A session-scoped PostgreSQL advisory lock prevents two concurrent fill jobs.
 * A persistent 60-minute gap and 6-hour rate-limit hold prevent manual bursts. */
export async function fillGraphInstagramAvatars(
  opts: { limit?: number } & Dependencies = {},
): Promise<GraphAvatarFill> {
  if (!process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN || !/^\d+$/.test(process.env.INSTAGRAM_GRAPH_OWNER_ID ?? ''))
    return skip('meta_credentials_missing');
  const limit = Math.min(GRAPH_AVATAR_RUN_LIMIT, Math.max(1, Math.trunc(opts.limit ?? GRAPH_AVATAR_RUN_LIMIT)));
  const probe = opts.probe ?? ((handle: string) => fetchGraphInstagramAvatar(handle));
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));
  const client = await pool.connect();
  let locked = false;
  try {
    const gateLock = await client.query<{ acquired: boolean }>('SELECT pg_try_advisory_lock(710327) AS acquired');
    locked = gateLock.rows[0]?.acquired === true;
    if (!locked) return skip('already_running');

    const active = await query("SELECT id FROM refresh_runs WHERE platform='instagram' AND status IN ('queued','running') LIMIT 1");
    if (active.rowCount) return skip('instagram_refresh_running');
    const g = await query<GraphAvatarGate>(`SELECT
      (SELECT MAX(started_at) FROM refresh_runs WHERE platform='instagram'
        AND status IN ('succeeded','partial','failed') AND started_at IS NOT NULL
        AND (counts->>'accounts')::int > 0) AS last_refresh,
      (SELECT MAX(last_attempt_at) FROM hub_graph_avatar_attempts) AS last_graph,
      GREATEST(
        (SELECT MAX(rr.created_at) FROM refresh_results rr JOIN refresh_runs r ON r.id=rr.run_id
         WHERE r.platform='instagram' AND rr.outcome='rate_limited' AND rr.detail LIKE 'graph_code_%'),
        (SELECT MAX(last_attempt_at) FROM hub_graph_avatar_attempts WHERE last_result='rate_limited')
      ) AS last_limited`);
    const nextEligibleAt = graphAvatarNextAllowedAt(g.rows[0] ?? { last_refresh: null, last_graph: null, last_limited: null }, Date.now());
    if (nextEligibleAt) return skip('meta_cooldown', nextEligibleAt);

    const candidates = await query<{ id: string; handle: string; external_id: string }>(`
      SELECT a.id, a.handle, a.external_id
      FROM accounts a
      LEFT JOIN hub_graph_avatar_attempts t ON t.account_id=a.id
      LEFT JOIN published_pointers p ON p.scope='instagram.followers'
      LEFT JOIN rank_slots s ON s.run_id=p.run_id AND s.person_id=a.person_id
      WHERE a.platform='instagram' AND (a.avatar_url IS NULL OR btrim(a.avatar_url)='')
        AND (t.last_attempt_at IS NULL OR t.last_attempt_at < now()-interval '24 hours')
      ORDER BY s.slot ASC NULLS LAST, t.last_attempt_at ASC NULLS FIRST, a.id
      LIMIT $1`, [limit]);
    if (!candidates.rows.length) return skip('no_eligible_missing_pictures');

    const out: GraphAvatarFill = { status: 'done', tried: 0, filled: 0,
      missing: 0, rejected: 0, unsupported: 0, failed: 0, stoppedEarly: false };
    let consecutiveErrors = 0;
    for (const account of candidates.rows) {
      if (out.tried > 0) await sleep(1000);
      const result = await probe(account.handle);
      out.tried++;
      // A failed bookkeeping write must stop the run rather than defeat the cooldown.
      await query(`INSERT INTO hub_graph_avatar_attempts(account_id,attempts,last_attempt_at,last_result)
        VALUES($1,1,now(),$2)
        ON CONFLICT(account_id) DO UPDATE SET attempts=hub_graph_avatar_attempts.attempts+1,
          last_attempt_at=now(),last_result=EXCLUDED.last_result`, [account.id, result.status]);
      if (result.status === 'ok' && result.url) {
        const saved = await query(`UPDATE accounts SET avatar_url=$2
          WHERE id=$1 AND (avatar_url IS NULL OR btrim(avatar_url)='') RETURNING id`, [account.id, result.url]);
        if (saved.rowCount) {
          out.filled++;
          await recordObservation({ sourceId: 'instagram.api',
            sourceRunRef: `avatar-graph:${account.id}:${new Date().toISOString()}`,
            accountId: account.id, entityKind: 'account', entityId: `instagram:${account.external_id}`,
            metric: 'avatar_url', valueNumeric: null, valueText: result.url,
            accuracy: 'exact', observedAt: new Date().toISOString(),
            metadata: { method: 'meta-business-discovery', identityMatch: true } }).catch(err =>
              logger.warn({ err, accountId: account.id }, 'Meta avatar observation unavailable'));
        }
        await reportSourceResult('instagram.api', true);
        consecutiveErrors = 0;
      } else if (result.status === 'missing') {
        out.missing++; consecutiveErrors = 0;
      } else if (result.status === 'rejected') {
        out.rejected++; consecutiveErrors = 0;
      } else if (result.status === 'unsupported' || result.status === 'identity_mismatch') {
        out.unsupported++; consecutiveErrors = 0;
      } else {
        out.failed++; consecutiveErrors++;
        if (result.status === 'token_invalid') {
          await reportSourceResult('instagram.api', false, 'TOKEN_INVALID');
          out.stoppedEarly = true; out.reason = 'meta_token_invalid'; break;
        }
        if (result.status === 'rate_limited') {
          await reportSourceResult('instagram.api', false, 'QUOTA');
          out.stoppedEarly = true; out.reason = 'meta_rate_limited'; break;
        }
        if (consecutiveErrors >= 2) {
          out.stoppedEarly = true; out.reason = 'meta_unavailable'; break;
        }
      }
    }
    return out;
  } finally {
    if (locked) {
      try { await client.query('SELECT pg_advisory_unlock(710327)'); }
      catch (err) { logger.warn({ err }, 'Meta avatar advisory unlock failed'); }
    }
    client.release();
  }
}
