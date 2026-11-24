'use client';
import { Notice } from '@pci/ui';
import { TableWrap, useData } from '@/components/Shared';
import { fmtDate, fmtNum } from '@/lib/api';

type Platform = 'youtube' | 'instagram';
type Metric = 'followers' | 'views' | 'posts_30d';
type MetricRow = {
  platform: Platform; metric: Metric; observations: number; uniqueAccounts: number;
  days: number; firstDay: string | null; lastDay: string | null;
};
type DailyRow = { day: string; platform: Platform; observations: number };
type LastRun = {
  platform: Platform; trigger: string; status: string; startedAt: string | null;
  finishedAt: string | null; counts: Record<string, number>; failureReason: string | null;
};
type Summary = {
  generatedAt: string; timezone: string; dailyWindowDays: number;
  totals: { observations: number; uniqueAccounts: number; days: number; firstDay: string | null; lastDay: string | null };
  metrics: MetricRow[]; daily: DailyRow[]; latestRuns: LastRun[];
  avatarCoverage: {platform: Platform; tracked: number; withPicture: number; missingPicture: number}[];
};

const metricName = (platform: Platform, metric: Metric) => {
  if (metric === 'followers') return platform === 'youtube' ? 'Subscribers' : 'Followers';
  if (metric === 'views') return 'Total channel views';
  return platform === 'youtube' ? 'Videos in past 30 days' : 'Posts in past 30 days';
};
const platformName = (platform: Platform) => platform === 'youtube' ? 'YouTube' : 'Instagram';
const dateOnly = (value: string | null) => value || '—';

export function CollectionSummary() {
  const { data, error, loading, reload } = useData<Summary>('/admin/refresh/summary');
  const youtube = data?.metrics.filter(m => m.platform === 'youtube') ?? [];
  const instagram = data?.metrics.filter(m => m.platform === 'instagram') ?? [];
  const ytAccounts = youtube.length ? Math.max(...youtube.map(m => m.uniqueAccounts)) : 0;
  const igAccounts = instagram.length ? Math.max(...instagram.map(m => m.uniqueAccounts)) : 0;
  const byDay = new Map<string, { youtube: number; instagram: number }>();
  for (const row of data?.daily ?? []) {
    const counts = byDay.get(row.day) ?? { youtube: 0, instagram: 0 };
    counts[row.platform] = row.observations;
    byDay.set(row.day, counts);
  }

  return <section className="glass-card" aria-labelledby="collection-summary-heading">
    <div className="admin-inline-actions">
      <h2 className="glass-h" id="collection-summary-heading">Collected metrics — database audit</h2>
      <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => reload()}>
        {loading ? 'Loading…' : 'Refresh data'}
      </button>
    </div>
    <p className="fineprint">Live PostgreSQL observation history (PKT). Counts below are recorded metric snapshots, not totals of views or followers.</p>
    {loading && !data && <p role="status" className="muted">Loading collection summary…</p>}
    {error && <Notice tone="warning">{error}. Collection summary may be unavailable while Module 1 is deploying.</Notice>}
    {data && <>
      <div className="glass-kpis" aria-label="Collection totals">
        <div className="glass-card kpi"><p className="kpi-label">Metric observations</p><p className="kpi-value">{fmtNum(data.totals.observations)}</p><p className="kpi-note">All-time, both platforms</p></div>
        <div className="glass-card kpi"><p className="kpi-label">Accounts with data</p><p className="kpi-value">{fmtNum(data.totals.uniqueAccounts)}</p><p className="kpi-note">{fmtNum(ytAccounts)} YouTube · {fmtNum(igAccounts)} Instagram</p></div>
        <div className="glass-card kpi"><p className="kpi-label">Days collected</p><p className="kpi-value">{fmtNum(data.totals.days)}</p><p className="kpi-note">Distinct Pakistan calendar days</p></div>
        <div className="glass-card kpi"><p className="kpi-label">History range</p><p className="kpi-value kpi-small">{dateOnly(data.totals.firstDay)} – {dateOnly(data.totals.lastDay)}</p><p className="kpi-note">Verified observations</p></div>
      </div>

      <h3 className="glass-h">Metrics recorded</h3>
      {data.metrics.length === 0 ? <p className="muted">No metric observations collected yet.</p> : <TableWrap>
        <thead><tr><th>Platform</th><th>Metric</th><th>Observations</th><th>Unique accounts</th><th>Days</th><th>First</th><th>Latest</th></tr></thead>
        <tbody>{data.metrics.map(row => <tr key={`${row.platform}-${row.metric}`}>
          <td>{platformName(row.platform)}</td><td>{metricName(row.platform, row.metric)}</td>
          <td>{fmtNum(row.observations)}</td><td>{fmtNum(row.uniqueAccounts)}</td>
          <td>{fmtNum(row.days)}</td><td>{dateOnly(row.firstDay)}</td><td>{dateOnly(row.lastDay)}</td>
        </tr>)}</tbody>
        <tfoot><tr><th colSpan={2}>All observations</th><th>{fmtNum(data.totals.observations)}</th><th>{fmtNum(data.totals.uniqueAccounts)} distinct</th><th>{fmtNum(data.totals.days)}</th><th colSpan={2}>All-time</th></tr></tfoot>
      </TableWrap>}

      <h3 className="glass-h">Account picture coverage</h3>
      <TableWrap>
        <thead><tr><th>Platform</th><th>Accounts tracked</th><th>With picture</th><th>Missing picture</th></tr></thead>
        <tbody>{(['youtube','instagram'] as const).map(platform => {
          const row = data.avatarCoverage.find(a => a.platform === platform);
          return <tr key={platform}><td>{platformName(platform)}</td>
            <td>{fmtNum(row?.tracked ?? 0)}</td><td>{fmtNum(row?.withPicture ?? 0)}</td>
            <td>{fmtNum(row?.missingPicture ?? 0)}</td></tr>;
        })}</tbody>
      </TableWrap>
      <p className="fineprint">Pictures stored in the accounts table are counted here. Actual image loading in public and admin interfaces is a separate check. TikTok metric collection is not enabled in the current backend.</p>

      <div className="glass-split glass-split-even">
        <div>
          <h3 className="glass-h">Daily observations — last {data.dailyWindowDays} days</h3>
          <TableWrap>
            <thead><tr><th>Date (PKT)</th><th>YouTube</th><th>Instagram</th><th>Total</th></tr></thead>
            <tbody>{[...byDay].map(([day, count]) => <tr key={day}>
              <td>{day}</td><td>{fmtNum(count.youtube)}</td><td>{fmtNum(count.instagram)}</td>
              <td>{fmtNum(count.youtube + count.instagram)}</td>
            </tr>)}</tbody>
          </TableWrap>
        </div>
        <div>
          <h3 className="glass-h">Latest platform refreshes</h3>
          <TableWrap>
            <thead><tr><th>Platform</th><th>Last run (PKT)</th><th>Status</th></tr></thead>
            <tbody>{(['youtube', 'instagram'] as const).map(platform => {
              const run = data.latestRuns.find(r => r.platform === platform);
              return <tr key={platform}>
                <td>{platformName(platform)}</td>
                <td>{run ? fmtDate(run.startedAt) : 'Never'}</td>
                <td><strong>{run?.status ?? 'No runs'}</strong>{run?.failureReason ? <span className="fineprint"> · {run.failureReason}</span> : null}</td>
              </tr>;
            })}</tbody>
          </TableWrap>
          <p className="fineprint">A failed refresh creates no new metric observations. Repeated manual refreshes increase observation counts without increasing the number of creators.</p>
        </div>
      </div>
      <p className="fineprint">Updated {fmtDate(data.generatedAt)}. Video-level catalogue and view-history tables are not included in this audit.</p>
    </>}
  </section>;
}
