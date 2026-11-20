import { query } from '../../lib/db.js';

const safe = async <T>(f: () => Promise<T>, fallback: T): Promise<T> => { try { return await f(); } catch { return fallback; } };

/** One call for the Pipeline screen. Every section degrades to empty if its table is missing. */
export async function getPipelineStatus() {
  const [worker, refresh, pipeline, live, alerts, counts] = await Promise.all([
    safe(async () => (await query('SELECT worker_id, kind, last_seen_at FROM worker_heartbeats ORDER BY last_seen_at DESC LIMIT 1')).rows[0] ?? null, null),
    safe(async () => (await query(`SELECT DISTINCT ON (platform) platform, id, status, created_at AS "createdAt", finished_at AS "finishedAt", counts, error FROM refresh_runs ORDER BY platform, created_at DESC`)).rows, []),
    safe(async () => (await query('SELECT id, trigger, status, created_at AS "createdAt", finished_at AS "finishedAt", steps FROM pipeline_runs ORDER BY created_at DESC LIMIT 5')).rows, []),
    safe(async () => (await query(`SELECT p.scope, r.published_at AS "publishedAt", (r.diagnostics->>'population')::int AS population, (SELECT count(*)::int FROM rank_slots s WHERE s.run_id=r.id) AS covered
      FROM published_pointers p JOIN rank_runs r ON r.id=p.run_id ORDER BY p.scope`)).rows, []),
    safe(async () => (await query('SELECT id, created_at AS "createdAt", kind, scope, message FROM pipeline_alerts WHERE NOT acknowledged ORDER BY created_at DESC LIMIT 20')).rows, []),
    safe(async () => (await query(`SELECT (SELECT count(*)::int FROM people) AS people, (SELECT count(*)::int FROM accounts WHERE platform='youtube') AS youtube, (SELECT count(*)::int FROM accounts WHERE platform='instagram') AS instagram`)).rows[0], { people: 0, youtube: 0, instagram: 0 })
  ]);
  const now = Date.now();
  const age = (iso: string | null) => (iso ? Math.round((now - new Date(iso).getTime()) / 3_600_000 * 10) / 10 : null);
  return {
    worker: worker ? { kind: worker.kind, lastSeenAt: worker.last_seen_at, healthy: now - new Date(worker.last_seen_at).getTime() < 90_000 } : null,
    dailyRun: { enabled: process.env.PCI_PIPELINE_DAILY !== 'false', schedule: '09:00 Asia/Karachi' },
    bucket: counts, refresh, pipeline, alerts,
    live: live.map((l: any) => ({ ...l, ageHours: age(l.publishedAt), stale: (age(l.publishedAt) ?? 0) > 36 }))
  };
}
