// Pure helpers behind the versus bars, kept free of React so they can be tested directly.
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
/** Percent of the bar to fill: against a fixed maximum, or against the higher of the two values. No bar for a missing or negative value. */
export function vsPercent(value, other, max) {
  if (!isNum(value) || value < 0) return null;
  const top = max ?? Math.max(0, value, isNum(other) ? other : 0);
  return top > 0 ? Math.max(0, Math.min(100, Math.round((value / top) * 100))) : 0;
}
/** 0 or 1 for the higher value, -1 for a tie or when neither side has a value. */
export function vsLeader(a, b) {
  if (!isNum(a) && !isNum(b)) return -1;
  if (!isNum(b)) return 0;
  if (!isNum(a)) return 1;
  return a === b ? -1 : a > b ? 0 : 1;
}
