// Pure helpers for the public API. No database, network or config imports.

export const SCOPE_RE = /^(wheel\.(subscribed|viewed|active)|youtube\.subscribed|instagram\.followers|category\.[a-z0-9-]{2,60})$/;
export const WHEEL_SCOPES = ['wheel.subscribed', 'wheel.viewed', 'wheel.active'] as const;
export const PLATFORM_SCOPES = ['youtube.subscribed', 'instagram.followers'] as const;
export const WHEEL_CARDS = 12;
export const ROW_SIZE = 15;
export const STALE_HOURS = 36;

export type ScopeInfo = { scope: string; kind: 'wheel' | 'platform' | 'category'; label: string; unit: string };

const FIXED: Record<string, { label: string; unit: string }> = {
  'wheel.subscribed': { label: 'Most Subscribed', unit: 'followers across platforms' },
  'wheel.viewed': { label: 'Most Viewed', unit: 'YouTube lifetime views' },
  'wheel.active': { label: 'Most Active', unit: 'posts in the last 30 days' },
  'youtube.subscribed': { label: 'YouTube', unit: 'subscribers' },
  'instagram.followers': { label: 'Instagram', unit: 'followers' }
};

/** Describes a scope for display. `categoryLabel` is used only for category scopes. */
export function scopeInfo(scope: string, categoryLabel?: string): ScopeInfo | null {
  if (!SCOPE_RE.test(scope)) return null;
  const f = FIXED[scope];
  if (f) return { scope, kind: scope.startsWith('wheel.') ? 'wheel' : 'platform', label: f.label, unit: f.unit };
  const slug = scope.slice('category.'.length);
  return { scope, kind: 'category', label: categoryLabel ?? slug, unit: 'followers across platforms' };
}

export function categorySlug(scope: string): string | null { return scope.startsWith('category.') && SCOPE_RE.test(scope) ? scope.slice(9) : null; }

/** Public link to an account, or null when the stored values do not look right. */
export function accountUrl(platform: string, externalId: string, handle: string): string | null {
  if (platform === 'youtube') return /^UC[A-Za-z0-9_-]{22}$/.test(externalId) ? `https://www.youtube.com/channel/${externalId}` : null;
  if (platform === 'instagram') { const h = handle.replace(/^@/, ''); return /^[A-Za-z0-9._]{1,30}$/.test(h) ? `https://www.instagram.com/${h}/` : null; }
  return null;
}

export function hoursSince(iso: string | null, now: Date): number | null {
  if (!iso) return null; const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, Math.floor((now.getTime() - t) / 3600000)) : null;
}
export function isStale(iso: string | null, now: Date, hours = STALE_HOURS): boolean { const h = hoursSince(iso, now); return h === null || h > hours; }

/** Escapes % _ and \ so a search term is matched literally by ILIKE. */
export function likePattern(term: string): string { return `%${term.replace(/[\\%_]/g, c => `\\${c}`)}%`; }

export function pageOf(page: number, limit: number, total: number) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total, pages };
}

export type SlotRow = { slot: number; rank: number; personId: string; value: string | number; tied: boolean; breakdown: { platform: string; value: number }[] };
export type PublicEntry<P> = { slot: number; rank: number; tied: boolean; value: number; counted: number; contributions: { platform: string; value: number }[]; person: P };

/** Joins slot rows with person records. A slot whose person cannot be found is dropped, never shown blank. */
export function toEntries<P>(rows: SlotRow[], people: Map<string, P>): PublicEntry<P>[] {
  const out: PublicEntry<P>[] = [];
  for (const r of rows) {
    const person = people.get(r.personId); if (!person) continue;
    out.push({ slot: r.slot, rank: r.rank, tied: r.tied, value: Number(r.value), counted: r.breakdown.length,
      contributions: r.breakdown.map(b => ({ platform: b.platform, value: Number(b.value) })), person });
  }
  return out;
}
