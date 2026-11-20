// Pure rules for turning provider output into what we store. No I/O.
import type { AccountRef, FetchResult, MetricName, MetricValue, Outcome } from '../../providers/types.js';
import { MAX_ATTEMPTS } from '../../providers/types.js';

const ALLOWED: Record<'youtube' | 'instagram', MetricName[]> = { youtube: ['followers', 'views', 'posts_30d'], instagram: ['followers', 'posts_30d'] };
export const RETRYABLE: ReadonlySet<Outcome> = new Set(['rate_limited', 'error']);
export const isRetryable = (o: Outcome) => RETRYABLE.has(o);
export { MAX_ATTEMPTS };

/** Exactly one result per requested account, in request order. Missing results become errors,
 * extras are ignored, only `ok` results carry metrics, and every stored value is a safe integer >= 0. */
export function normalizeResults(accounts: AccountRef[], results: FetchResult[]): FetchResult[] {
  const by = new Map<string, FetchResult>();
  for (const r of results) if (!by.has(r.accountId)) by.set(r.accountId, r);
  return accounts.map(a => {
    const r = by.get(a.id);
    if (!r) return { accountId: a.id, outcome: 'error' as const, metrics: [], detail: 'provider_returned_nothing' };
    if (r.outcome !== 'ok' || a.platform === 'tiktok') return { ...r, metrics: [] };
    const seen = new Set<MetricName>();
    const metrics: MetricValue[] = [];
    for (const m of r.metrics) {
      if (!(ALLOWED[a.platform as 'youtube' | 'instagram'] as string[]).includes(m.metric) || seen.has(m.metric)) continue;
      if (!Number.isSafeInteger(m.value) || m.value < 0) continue; // never store a bad number, never store zero for a bad number
      seen.add(m.metric); metrics.push(m);
    }
    if (!metrics.length) return { ...r, outcome: 'error' as const, metrics: [], detail: r.detail ? `no_valid_metrics,${r.detail}` : 'no_valid_metrics' };
    return { ...r, metrics };
  });
}

export type RunStatus = 'succeeded' | 'partial' | 'failed';
/** No accounts: succeeded. Nothing ok: failed. Everything ok: succeeded. Otherwise partial. */
export function summarizeRun(total: number, counts: Partial<Record<Outcome, number>>): RunStatus {
  if (total === 0) return 'succeeded';
  const ok = counts.ok ?? 0;
  if (ok === 0) return 'failed';
  return ok === total ? 'succeeded' : 'partial';
}

export const backoffMs = (attempt: number) => Math.min(8000, 1000 * 2 ** (attempt - 1));
export function retentionDays(platform: 'youtube' | 'instagram', env: NodeJS.ProcessEnv = process.env): number {
  const raw = env[`PCI_RETENTION_DAYS_${platform.toUpperCase()}`];
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isInteger(n) && n >= 8 && n <= 3650 ? n : 90;
}
