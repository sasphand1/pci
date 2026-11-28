/** The current Pakistan calendar day's 09:00 slot. Do not backfill previous days. */
export function dailyPipelineSlot(at: Date): {start: string; end: string} | null {
  const ms = at.getTime();
  if (!Number.isFinite(ms)) throw new Error('Invalid daily pipeline clock');
  // Pakistan Standard Time is UTC+05:00. Calculate day boundaries in that calendar.
  const shifted = new Date(ms + 5 * 60 * 60_000);
  const year = shifted.getUTCFullYear(), month = shifted.getUTCMonth(), day = shifted.getUTCDate();
  const start = Date.UTC(year, month, day, 4); // 09:00 PKT
  const end = Date.UTC(year, month, day + 1) - 5 * 60 * 60_000; // midnight PKT
  if (ms < start || ms >= end) return null;
  return {start: new Date(start).toISOString(), end: new Date(end).toISOString()};
}
