/** Deterministic, public-data-only estimates. Not actual creator revenue. */
export const SOCIAL_BLADE_MIN_RPM_USD = 0.25;
export const SOCIAL_BLADE_MAX_RPM_USD = 4;
// PCI displays one figure: the arithmetic midpoint of Social Blade's assumptions.
export const ASSUMED_RPM_USD = (SOCIAL_BLADE_MIN_RPM_USD + SOCIAL_BLADE_MAX_RPM_USD) / 2;
const DAY_MS = 86_400_000;

export type ObservationPoint = { at: string; value: number };
export type MonthlyEstimate = {
  usd: number;
  measuredDays: number;
  assumedRpmUsd: number;
  equivalent30DayViews: number;
} | null;

function validPoints(samples: ObservationPoint[]): ObservationPoint[] {
  return samples.filter(s => Number.isSafeInteger(s.value) && s.value >= 0 &&
    Number.isFinite(Date.parse(s.at))).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/**
 * Requires two fresh, real observations at least two days apart. Annualizes the
 * actual observed channel-view delta to a 30-day pace; never uses lifetime views as monthly views.
 * Return null on stale, missing, counter-reset or unsafe data.
 */
export function estimateMonthlyEarnings(samples: ObservationPoint[], now = new Date()): MonthlyEstimate {
  const all = validPoints(samples);
  const latest = all.at(-1);
  if (!latest || now.getTime() - Date.parse(latest.at) > 2 * DAY_MS || Date.parse(latest.at) > now.getTime() + 60_000) return null;
  const earlier = all.filter(s => {
    const days = (Date.parse(latest.at) - Date.parse(s.at)) / DAY_MS;
    return days >= 2 && days <= 31;
  });
  const first = earlier[0];
  if (!first || latest.value < first.value) return null;
  const elapsedDays = (Date.parse(latest.at) - Date.parse(first.at)) / DAY_MS;
  const equivalent30DayViews = Math.round((latest.value - first.value) / elapsedDays * 30);
  const usd = Math.round(equivalent30DayViews / 1000 * ASSUMED_RPM_USD);
  if (!Number.isSafeInteger(equivalent30DayViews) || !Number.isSafeInteger(usd)) return null;
  return {usd, measuredDays: Math.round(elapsedDays * 10) / 10, assumedRpmUsd: ASSUMED_RPM_USD, equivalent30DayViews};
}

/** Requires a sample close to the requested lookback, not a fabricated data point. */
export function gainAtPeriod(samples: ObservationPoint[], days: 1 | 7 | 30, now = new Date()): number | null {
  const all = validPoints(samples);
  const latest = all.at(-1);
  if (!latest || now.getTime() - Date.parse(latest.at) > 2 * DAY_MS) return null;
  const target = Date.parse(latest.at) - days * DAY_MS;
  const tolerance = days === 1 ? 12 * 3_600_000 : days === 7 ? DAY_MS : 2 * DAY_MS;
  const baseline = all.filter(p => Math.abs(Date.parse(p.at) - target) <= tolerance)
    .sort((a, b) => Math.abs(Date.parse(a.at) - target) - Math.abs(Date.parse(b.at) - target))[0];
  if (!baseline || latest.value < baseline.value) return null;
  return latest.value - baseline.value;
}

/** Keep the most recent measurement in each UTC day, without pretending missing days exist. */
export function dailyHistory(samples: ObservationPoint[]): ObservationPoint[] {
  const dates = new Map<string, ObservationPoint>();
  for (const p of validPoints(samples)) dates.set(p.at.slice(0, 10), p);
  return [...dates.values()];
}
