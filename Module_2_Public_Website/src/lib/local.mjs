// Pure helpers for the restaurant guide: flatten, filter and order places.
export const LOCAL_SORTS = [{ id: 'rank', label: 'Best ranked' }, { id: 'rating', label: 'Highest rated' }, { id: 'reviews', label: 'Most reviewed' }, { id: 'name', label: 'Name A–Z' }];
export const MAX_LOCAL_COMPARE = 2;

/** One flat list. Each place knows its city; picks are marked and carry no rank. */
export function flattenPlaces(cities) {
  const out = [];
  for (const c of cities || []) {
    for (const p of c.picks || []) out.push({ ...p, city: c.slug, cityLabel: c.label, pick: true });
    for (const p of c.places || []) out.push({ ...p, city: c.slug, cityLabel: c.label, pick: false });
  }
  return out;
}

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
export function filterPlaces(items, { city = '', query = '', sort = 'rank' } = {}) {
  const q = String(query).trim().toLowerCase();
  const list = items.filter((p) => (!city || p.city === city) && (!q || `${p.name} ${p.area ?? ''} ${p.address ?? ''}`.toLowerCase().includes(q)));
  const by = {
    rank: (a, b) => num(a.rank, 1e9) - num(b.rank, 1e9) || a.cityLabel.localeCompare(b.cityLabel) || a.name.localeCompare(b.name),
    rating: (a, b) => num(b.rating, -1) - num(a.rating, -1) || num(b.reviewCount, -1) - num(a.reviewCount, -1) || a.name.localeCompare(b.name),
    reviews: (a, b) => num(b.reviewCount, -1) - num(a.reviewCount, -1) || a.name.localeCompare(b.name),
    name: (a, b) => a.name.localeCompare(b.name),
  }[sort] || null;
  return by ? [...list].sort(by) : list;
}
export const splitPicks = (items) => ({ picks: items.filter((p) => p.pick), ranked: items.filter((p) => !p.pick) });
export const placeKey = (p) => `${p.city}:${p.placeId}`;
export function asOfShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
