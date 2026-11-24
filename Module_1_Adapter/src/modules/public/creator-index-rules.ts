/** Pure helpers for the public creator index (last-known figures, sorting, parsing). */
export const FRESH_DAYS = 7;
export type Fig = { platform: string; followers: number | null; views: number | null; posts30d: number | null; asOf: string | null };

export const SORTS = ['rank', 'followers', 'name'] as const;
export type Sort = (typeof SORTS)[number];
export const parseSort = (v: unknown): Sort => (SORTS as readonly string[]).includes(String(v)) ? String(v) as Sort : 'rank';
export const PLATFORMS = ['youtube', 'instagram'] as const;
export const parsePlatform = (v: unknown): 'youtube' | 'instagram' | '' => (PLATFORMS as readonly string[]).includes(String(v)) ? String(v) as 'youtube' | 'instagram' : '';

/** Followers add up across a creator's accounts; a creator with no follower figure is null, never zero. */
export function totalFollowers(figs: Fig[]): number | null {
  const xs = figs.map(f => f.followers).filter((x): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0);
  return xs.length ? xs.reduce((a, b) => a + b, 0) : null;
}
export function latestAsOf(figs: Fig[]): string | null {
  const xs = figs.map(f => f.asOf).filter((x): x is string => !!x).sort();
  return xs.length ? xs[xs.length - 1] : null;
}
/** True when the newest figure is older than the freshness window. The value is still shown, labelled with its date. */
export function isStaleAsOf(asOf: string | null, nowMs: number): boolean {
  if (!asOf) return false;
  const t = new Date(asOf).getTime();
  return Number.isFinite(t) && nowMs - t > FRESH_DAYS * 86_400_000;
}
/** Up to four distinct, well-formed slugs, in the order given. */
export function parseSlugs(v: unknown): string[] {
  const raw = typeof v === 'string' ? v.split(',') : [];
  const out: string[] = [];
  for (const s of raw.map(x => x.trim().toLowerCase())) if (/^[a-z0-9-]{2,60}$/.test(s) && !out.includes(s)) out.push(s);
  return out.slice(0, 4);
}
