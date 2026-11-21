import { query } from '../../lib/db.js';
import { attentionItems, changePct, systemState, toSeries, type DayPoint } from './overview-shape.js';

const safe = async <T>(f: () => Promise<T>, fallback: T): Promise<T> => { try { return await f(); } catch { return fallback; } };
const STALE_HOURS = 36;

/** One read for the management Overview. Every section degrades to empty if its table is missing. Read-only. */
export async function getOverview() {
  const [counts, fresh, noCat, series, last, alerts, top, worker, pipeline, live] = await Promise.all([
    safe(async () => (await query(`SELECT (SELECT count(*)::int FROM people) AS people,
        (SELECT count(*)::int FROM accounts WHERE platform='youtube') AS youtube,
        (SELECT count(*)::int FROM accounts WHERE platform='instagram') AS instagram`)).rows[0], { people: 0, youtube: 0, instagram: 0 }),
    // Latest reading per account within 7 days. An older reading is never counted as a number.
    safe(async () => (await query(`SELECT a.platform, count(*)::int AS fresh, COALESCE(sum(o.value),0)::text AS audience
        FROM accounts a JOIN LATERAL (SELECT value FROM metric_observations WHERE account_id=a.id AND metric='followers'
          AND observed_at > now() - interval '7 days' ORDER BY observed_at DESC LIMIT 1) o ON true GROUP BY a.platform`)).rows, [] as { platform: string; fresh: number; audience: string }[]),
    safe(async () => (await query(`SELECT count(*)::int AS n FROM people p WHERE NOT EXISTS (SELECT 1 FROM person_categories c WHERE c.person_id=p.id)`)).rows[0].n as number, 0),
    safe(async () => (await query(`SELECT day::text AS day, platform, sum(v)::text AS value FROM (
          SELECT a.platform, (o.observed_at AT TIME ZONE 'Asia/Karachi')::date AS day, o.account_id, max(o.value) AS v
          FROM metric_observations o JOIN accounts a ON a.id=o.account_id
          WHERE o.metric='followers' AND o.observed_at > now() - interval '30 days' GROUP BY 1,2,3) t GROUP BY day, platform ORDER BY day`)).rows, [] as { day: string; platform: string; value: string }[]),
    safe(async () => (await query(`SELECT max(r.published_at) AS at FROM published_pointers p JOIN rank_runs r ON r.id=p.run_id`)).rows[0].at as string | null, null),
    safe(async () => (await query(`SELECT count(*)::int AS n FROM pipeline_alerts WHERE NOT acknowledged`)).rows[0].n as number, 0),
    safe(async () => (await query(`SELECT s.slot, s.rank, p.display_name AS "displayName", s.value::text AS value
        FROM published_pointers pp JOIN rank_slots s ON s.run_id=pp.run_id JOIN people p ON p.id=s.person_id
        WHERE pp.scope='wheel.subscribed' AND s.slot<=5 ORDER BY s.slot`)).rows, [] as { slot: number; rank: number; displayName: string; value: string }[]),
    safe(async () => (await query('SELECT last_seen_at FROM worker_heartbeats ORDER BY last_seen_at DESC LIMIT 1')).rows[0] ?? null, null),
    safe(async () => (await query('SELECT id, trigger, status, created_at AS "createdAt", finished_at AS "finishedAt", steps FROM pipeline_runs ORDER BY created_at DESC LIMIT 1')).rows[0] ?? null, null),
    safe(async () => (await query(`SELECT count(*)::int AS published, count(*) FILTER (WHERE r.published_at < now() - interval '${STALE_HOURS} hours')::int AS stale
        FROM published_pointers p JOIN rank_runs r ON r.id=p.run_id`)).rows[0], { published: 0, stale: 0 })
  ]);

  const total = counts.youtube + counts.instagram;
  const freshBy = (p: string) => fresh.find(f => f.platform === p);
  const accountsFresh = (freshBy('youtube')?.fresh ?? 0) + (freshBy('instagram')?.fresh ?? 0);
  const audience = { youtube: Number(freshBy('youtube')?.audience ?? 0), instagram: Number(freshBy('instagram')?.audience ?? 0) };
  const points: DayPoint[] = series.map(r => ({ day: r.day, platform: r.platform, value: Number(r.value) }));
  const s = toSeries(points);
  const workerHealthy = worker ? Date.now() - new Date(worker.last_seen_at).getTime() < 90_000 : null;
  const dailyEnabled = process.env.PCI_PIPELINE_DAILY !== 'false';

  return {
    people: counts.people,
    accounts: { total, youtube: counts.youtube, instagram: counts.instagram, withNumbers: accountsFresh },
    audience: { ...audience, total: audience.youtube + audience.instagram, changePct: changePct(s.days.map((_, i) => (s.youtube[i] ?? 0) + (s.instagram[i] ?? 0) || null)) },
    series: s,
    lastPublishedAt: last,
    openAlerts: alerts,
    pipeline: pipeline ? { status: pipeline.status, trigger: pipeline.trigger, createdAt: pipeline.createdAt, finishedAt: pipeline.finishedAt, steps: pipeline.steps } : null,
    worker: { healthy: workerHealthy, dailyEnabled, schedule: '09:00 Asia/Karachi' },
    top,
    attention: attentionItems({ accountsTotal: total, accountsFresh, peopleTotal: counts.people, peopleWithoutCategory: noCat, openAlerts: alerts, staleScopes: live.stale }),
    state: systemState({ workerHealthy, dailyEnabled, openAlerts: alerts, staleScopes: live.stale, lastPipelineStatus: pipeline?.status ?? null, published: live.published > 0 })
  };
}
