import type { FetchResult } from '../../providers/types.js';

// Conservative operational defaults; configurable later as usage history becomes available.
export const INSTAGRAM_PER_RUN = 35;
export const INSTAGRAM_MIN_INTERVAL_MINUTES = 60;
export const INSTAGRAM_LIMIT_COOLDOWN_MINUTES = 360;

export function isInstagramLimit(result: Pick<FetchResult, 'outcome' | 'detail'>): boolean {
  return result.outcome === 'rate_limited';
}

/** True means do not even create a Meta refresh job. Uses persisted timestamps, not memory. */
export function shouldHoldInstagramRun(
  last: { last_run: string | Date | null; last_limited: string | Date | null } | undefined,
  nowMs: number,
): boolean {
  if (!last) return false;
  const isRecent = (value: string | Date | null, minutes: number) => {
    if (!value) return false;
    const time = new Date(value).getTime();
    return Number.isFinite(time) && time <= nowMs && nowMs - time < minutes * 60_000;
  };
  return isRecent(last.last_limited, INSTAGRAM_LIMIT_COOLDOWN_MINUTES)
    || isRecent(last.last_run, INSTAGRAM_MIN_INTERVAL_MINUTES);
}
