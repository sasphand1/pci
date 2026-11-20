import type { Aggregated } from './aggregate.js';

/** value desc, then largest single-account value desc, then created_at asc, then id asc. Total order. */
export function compareAggregated(a: Aggregated, b: Aggregated): number {
  if (a.value !== b.value) return b.value - a.value;
  if (a.maxSingle !== b.maxSingle) return b.maxSingle - a.maxSingle;
  const ta = Date.parse(a.createdAt), tb = Date.parse(b.createdAt);
  if (ta !== tb) return ta - tb;
  return a.personId < b.personId ? -1 : a.personId > b.personId ? 1 : 0;
}
export const orderAggregated = (rows: Aggregated[]) => [...rows].sort(compareAggregated);
