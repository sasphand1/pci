// Pure rules for the management Overview page. No database, no clock: everything arrives as arguments.

export type Attention = { key: 'no_numbers' | 'no_category' | 'alerts' | 'stale' | 'worker'; severity: 'warning' | 'info'; count: number; message: string; href: string };
export type SystemState = { level: 'ok' | 'attention' | 'down'; label: string; reasons: string[] };

export type AttentionInput = {
  accountsTotal: number;
  accountsFresh: number;
  peopleTotal: number;
  peopleWithoutCategory: number;
  openAlerts: number;
  staleScopes: number;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** What needs a human, most important first. Empty list means nothing does. */
export function attentionItems(i: AttentionInput): Attention[] {
  const out: Attention[] = [];
  const noNumbers = Math.max(0, i.accountsTotal - i.accountsFresh);
  if (i.openAlerts > 0) out.push({ key: 'alerts', severity: 'warning', count: i.openAlerts, message: `${plural(i.openAlerts, 'pipeline alert is', 'pipeline alerts are')} waiting to be reviewed`, href: '/pipeline' });
  if (i.staleScopes > 0) out.push({ key: 'stale', severity: 'warning', count: i.staleScopes, message: `${plural(i.staleScopes, 'ranking was', 'rankings were')} not refreshed in the last 36 hours`, href: '/pipeline' });
  if (noNumbers > 0) out.push({ key: 'no_numbers', severity: 'warning', count: noNumbers, message: `${plural(noNumbers, 'account has', 'accounts have')} no recent numbers`, href: '/bucket' });
  if (i.peopleWithoutCategory > 0) out.push({ key: 'no_category', severity: 'info', count: i.peopleWithoutCategory, message: `${plural(i.peopleWithoutCategory, 'person has', 'people have')} no niche`, href: '/bucket' });
  return out;
}

export type StateInput = { workerHealthy: boolean | null; dailyEnabled: boolean; openAlerts: number; staleScopes: number; lastPipelineStatus: string | null; published: boolean };

/** One badge for the top bar. "down" means the daily job cannot be relied on. */
export function systemState(i: StateInput): SystemState {
  const reasons: string[] = [];
  let down = false;
  if (i.dailyEnabled && i.workerHealthy !== true) { down = true; reasons.push(i.workerHealthy === null ? 'The background worker has not been seen' : 'The background worker stopped responding'); }
  if (i.lastPipelineStatus === 'failed') reasons.push('The last pipeline run failed');
  if (i.openAlerts > 0) reasons.push(`${i.openAlerts} open ${plural(i.openAlerts, 'alert', 'alerts')}`);
  if (i.staleScopes > 0) reasons.push('Some rankings are out of date');
  if (!i.published) reasons.push('Nothing is published yet');
  if (down) return { level: 'down', label: 'Needs action', reasons };
  if (reasons.length) return { level: 'attention', label: 'Attention', reasons };
  return { level: 'ok', label: 'All systems ok', reasons };
}

export type DayPoint = { day: string; platform: string; value: number };
export type Series = { days: string[]; youtube: (number | null)[]; instagram: (number | null)[] };

/** Rows of (day, platform, value) to aligned arrays. A platform with no reading on a day is null, never zero. */
export function toSeries(rows: DayPoint[]): Series {
  const days = [...new Set(rows.map(r => r.day))].sort();
  const pick = (p: string) => days.map(d => { const r = rows.find(x => x.day === d && x.platform === p); return r ? r.value : null; });
  return { days, youtube: pick('youtube'), instagram: pick('instagram') };
}

/** Percentage change between the first and last non-null value, one decimal. Null when it cannot be computed honestly. */
export function changePct(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null);
  if (v.length < 2 || v[0] <= 0) return null;
  return Math.round(((v[v.length - 1] - v[0]) / v[0]) * 1000) / 10;
}

/** Compact audience figure: 1,234 / 12.4K / 8.9M / 1.2B. Rounds, never truncates a digit silently. */
export function compact(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  const f = (x: number, s: string) => `${(Math.round(x * 10) / 10).toString()}${s}`;
  if (n >= 1e9) return f(n / 1e9, 'B');
  if (n >= 1e6) return f(n / 1e6, 'M');
  if (n >= 1e4) return f(n / 1e3, 'K');
  return n.toLocaleString('en-US');
}
