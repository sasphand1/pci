import { query } from '../../lib/db.js';
import type { Platform } from '../../providers/types.js';

/** Live, read-only collection audit. Dates are calculated in Pakistan time (PKT).
 * Historical totals are all-time; daily counts cover the most recent 14 PKT days.
 * All counts are observations, never sums of subscribers or cumulative views.
 */
export type MetricSummaryRow = {
  platform: Platform;
  metric: 'followers' | 'views' | 'posts_30d';
  observations: number;
  uniqueAccounts: number;
  days: number;
  firstDay: string | null;
  lastDay: string | null;
};
export type DailyCollectionRow = { day: string; platform: Platform; observations: number };
export type LastCollectionRun = {
  platform: Platform;
  trigger: 'manual' | 'scheduled' | 'system';
  status: 'queued' | 'running' | 'succeeded' | 'partial' | 'failed';
  startedAt: string | null;
  finishedAt: string | null;
  counts: Record<string, number>;
  failureReason: string | null;
};
export type AvatarCoverage = { platform: 'youtube' | 'instagram'; tracked: number; withPicture: number; missingPicture: number };
export type CollectionSummary = {
  generatedAt: string;
  timezone: 'Asia/Karachi';
  dailyWindowDays: 14;
  totals: {
    observations: number;
    uniqueAccounts: number;
    days: number;
    firstDay: string | null;
    lastDay: string | null;
  };
  metrics: MetricSummaryRow[];
  daily: DailyCollectionRow[];
  latestRuns: LastCollectionRun[];
  avatarCoverage: AvatarCoverage[];
};

export async function getCollectionSummary(): Promise<CollectionSummary> {
  // Read-only queries against the existing metric history and refresh-run tables.
  const [total, metrics, daily, latestRuns, avatarCoverage] = await Promise.all([
    query<CollectionSummary['totals']>(`
      SELECT COUNT(*)::int AS observations,
        COUNT(DISTINCT account_id)::int AS "uniqueAccounts",
        COUNT(DISTINCT (observed_at AT TIME ZONE 'Asia/Karachi')::date)::int AS days,
        MIN((observed_at AT TIME ZONE 'Asia/Karachi')::date)::text AS "firstDay",
        MAX((observed_at AT TIME ZONE 'Asia/Karachi')::date)::text AS "lastDay"
      FROM metric_observations`),
    query<MetricSummaryRow>(`
      SELECT a.platform, o.metric,
        COUNT(*)::int AS observations,
        COUNT(DISTINCT o.account_id)::int AS "uniqueAccounts",
        COUNT(DISTINCT (o.observed_at AT TIME ZONE 'Asia/Karachi')::date)::int AS days,
        MIN((o.observed_at AT TIME ZONE 'Asia/Karachi')::date)::text AS "firstDay",
        MAX((o.observed_at AT TIME ZONE 'Asia/Karachi')::date)::text AS "lastDay"
      FROM metric_observations o
      JOIN accounts a ON a.id = o.account_id
      WHERE a.platform IN ('youtube', 'instagram')
      GROUP BY a.platform, o.metric
      ORDER BY CASE a.platform WHEN 'youtube' THEN 0 ELSE 1 END,
        CASE o.metric WHEN 'followers' THEN 0 WHEN 'views' THEN 1 ELSE 2 END`),
    query<DailyCollectionRow>(`
      WITH days AS (
        SELECT generate_series(
          ((now() AT TIME ZONE 'Asia/Karachi')::date - 13)::timestamp,
          (now() AT TIME ZONE 'Asia/Karachi')::date::timestamp,
          interval '1 day'
        )::date AS day
      ),
      samples AS (
        SELECT (o.observed_at AT TIME ZONE 'Asia/Karachi')::date AS day,
          a.platform, COUNT(*)::int AS observations
        FROM metric_observations o
        JOIN accounts a ON a.id = o.account_id
        WHERE o.observed_at >= now() - interval '15 days'
          AND a.platform IN ('youtube', 'instagram')
        GROUP BY 1, 2
      )
      SELECT d.day::text AS day, p.platform,
        COALESCE(s.observations, 0)::int AS observations
      FROM days d
      CROSS JOIN (VALUES ('youtube'::text), ('instagram'::text)) AS p(platform)
      LEFT JOIN samples s ON s.day = d.day AND s.platform = p.platform
      ORDER BY d.day DESC, p.platform`),
    query<LastCollectionRun>(`
      SELECT DISTINCT ON (r.platform)
        r.platform, r.trigger, r.status,
        r.started_at AS "startedAt", r.finished_at AS "finishedAt", r.counts,
        COALESCE((
          SELECT rr.detail FROM refresh_results rr
          WHERE rr.run_id = r.id AND rr.outcome <> 'ok' AND rr.detail IS NOT NULL
          GROUP BY rr.detail ORDER BY COUNT(*) DESC, rr.detail LIMIT 1
        ), r.error) AS "failureReason"
      FROM refresh_runs r
      WHERE r.platform IN ('youtube', 'instagram')
      ORDER BY r.platform, r.created_at DESC, r.id DESC`),
    query<AvatarCoverage>(`
      SELECT platform, COUNT(*)::int AS tracked,
        COUNT(*) FILTER (WHERE avatar_url IS NOT NULL)::int AS "withPicture",
        COUNT(*) FILTER (WHERE avatar_url IS NULL)::int AS "missingPicture"
      FROM accounts WHERE platform IN ('youtube','instagram')
      GROUP BY platform ORDER BY platform`),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    timezone: 'Asia/Karachi',
    dailyWindowDays: 14,
    totals: total.rows[0] ?? { observations: 0, uniqueAccounts: 0, days: 0, firstDay: null, lastDay: null },
    metrics: metrics.rows,
    daily: daily.rows,
    latestRuns: latestRuns.rows,
    avatarCoverage: avatarCoverage.rows,
  };
}
