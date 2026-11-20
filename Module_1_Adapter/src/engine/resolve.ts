import type { Observation } from './types.js';

const DAY_MS = 86_400_000;
const FUTURE_TOLERANCE_MS = 5 * 60_000;

/** Latest observation per `${accountId}|${metric}`. Order of the input never matters:
 * ties on time are broken by larger value, then by accuracy name. */
export function latestByKey(observations: Observation[], nowMs: number): Map<string, Observation> {
  const best = new Map<string, Observation & { t: number }>();
  for (const o of observations) {
    const t = Date.parse(o.observedAt);
    if (!Number.isFinite(t) || t > nowMs + FUTURE_TOLERANCE_MS) continue; // unreadable or from the future: ignore
    if (!Number.isSafeInteger(o.value) || o.value < 0) continue; // never trust a bad value
    const key = `${o.accountId}|${o.metric}`;
    const cur = best.get(key);
    if (!cur || t > cur.t || (t === cur.t && (o.value > cur.value || (o.value === cur.value && o.accuracy < cur.accuracy)))) best.set(key, { ...o, t });
  }
  return best;
}

/** The value to use, or null when missing. Missing is never zero. A stale latest value is missing:
 * we do not fall back to an older one. */
export function resolveValue(latest: Map<string, Observation>, accountId: string, metric: string, nowMs: number, freshnessDays: number): Observation | null {
  const o = latest.get(`${accountId}|${metric}`);
  if (!o) return null;
  return nowMs - Date.parse(o.observedAt) <= freshnessDays * DAY_MS ? o : null;
}
