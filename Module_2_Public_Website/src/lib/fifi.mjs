// Pure helpers for the Fifi public design. No I/O, so every rule here is unit tested.
// Data honesty: a missing value stays null and is shown as "not available". It is never turned into 0.

/** Change the brand here and every title, header and footer follows. */
export const BRAND = Object.freeze({
  wordmark: 'fifi',
  name: 'Fifi',
  product: 'Pakistan Creator Index',
  tagline: "Pakistan's people. Places. Possibilities.",
});

export const NAV = Object.freeze([
  {label: 'Home', href: '/'},
  {label: 'Creators', href: '/creators'},
  {label: 'Dramas', href: '/dramas'},
  {label: 'Events', href: '/events'},
  {label: 'Local', href: '/local'},
  {label: 'Signals', href: '/satify'},
  {label: 'Insights', href: '/insights'},
  {label: 'About', href: '/about'},
]);

export function isActivePath(pathname, href) {
  if (typeof pathname !== 'string') return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Percentage growth over a window, from the absolute gain the API reports. Null when it cannot be computed honestly. */
export function growthPercent(current, gain) {
  if (typeof current !== 'number' || typeof gain !== 'number') return null;
  if (!Number.isFinite(current) || !Number.isFinite(gain)) return null;
  const base = current - gain;
  if (base <= 0) return null;
  return (gain / base) * 100;
}

export function formatPercent(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Not available';
  const sign = value > 0 ? '+' : '';
  const digits = Math.abs(value) >= 10 ? 0 : 1;
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatCompact(value) {
  if (value === null || value === undefined) return 'Not available';
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Not available';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${trim(n / 1e9)}B`;
  if (abs >= 1e6) return `${trim(n / 1e6)}M`;
  if (abs >= 1e3) return `${trim(n / 1e3)}K`;
  return String(Math.round(n));
}
function trim(n) {
  return (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(1)).replace(/\.0$/, '');
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function platformLabel(platform) {
  return platform === 'youtube' ? 'YouTube' : platform === 'instagram' ? 'Instagram' : String(platform || '');
}

/** One card per ranked person, in published order. Ties keep their shared rank. */
export function toCreatorCards(ranking, limit = 8) {
  if (!ranking || !Array.isArray(ranking.entries)) return [];
  return ranking.entries
    .filter((e) => e && e.person && typeof e.person.slug === 'string')
    .slice(0, Math.max(0, limit))
    .map((e) => ({
      slug: e.person.slug,
      name: e.person.displayName,
      avatarUrl: e.person.avatarUrl ?? null,
      rank: e.rank,
      tied: Boolean(e.tied),
      value: typeof e.value === 'number' ? e.value : null,
      unit: ranking.unit,
      category: e.person.categories?.[0]?.label ?? null,
      platforms: Array.from(new Set((e.person.accounts || []).map((a) => a.platform))),
    }));
}

/** Home headline numbers. Every figure is either taken from published data or reported as not available. */
export function buildHomeStats({status, rows, eventsUpcoming}) {
  const population = (scope) => {
    const r = rows?.platforms?.find((x) => x.scope === scope);
    return typeof r?.population === 'number' ? r.population : null;
  };
  return [
    {key: 'people', label: 'Tracked creators', value: typeof status?.people === 'number' ? status.people : null},
    {key: 'youtube', label: 'YouTube creators ranked', value: population('youtube.subscribed')},
    {key: 'instagram', label: 'Instagram creators ranked', value: population('instagram.followers')},
    {key: 'events', label: 'Upcoming events', value: typeof eventsUpcoming === 'number' ? eventsUpcoming : null},
  ];
}

/** Fastest-growing creators in the supplied window, from the analytics the API already publishes. */
export function topMovers(items, window = '7d', limit = 5) {
  return (items || [])
    .map((x) => {
      const gain = x?.analytics?.growth?.subscribers?.[window];
      const pct = growthPercent(x?.subscribers, gain);
      return {slug: x.slug, name: x.name, gain: typeof gain === 'number' ? gain : null, pct};
    })
    .filter((x) => x.pct !== null && x.gain !== null && x.gain > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, limit);
}

/** Freshness label for a published snapshot. */
export function freshness(publishedAt, now = Date.now(), staleHours = 36) {
  if (!publishedAt) return {state: 'unknown', label: 'No published snapshot yet'};
  const t = Date.parse(publishedAt);
  if (!Number.isFinite(t)) return {state: 'unknown', label: 'No published snapshot yet'};
  const hours = (now - t) / 36e5;
  if (hours > staleHours) return {state: 'stale', label: 'Snapshot is older than expected'};
  return {state: 'fresh', label: 'Snapshot is current'};
}

export function safeSearchParam(value, max = 100) {
  return typeof value === 'string' ? value.slice(0, max).replace(/[\u0000-\u001f]/g, '') : '';
}
export function safePage(value) {
  return /^\d+$/.test(value || '') ? Math.min(10000, Math.max(1, Number(value))) : 1;
}
export function safeSlug(value) {
  return typeof value === 'string' && /^[a-z0-9-]{2,60}$/.test(value) ? value : '';
}
