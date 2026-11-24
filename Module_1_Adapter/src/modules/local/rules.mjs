/** Pure rules for the local places Top 20. No database, no network. */
export const CITIES = {
  karachi: { label: 'Karachi', areas: ['Clifton', 'DHA', 'Gulshan-e-Iqbal', 'Saddar', 'PECHS', 'North Nazimabad', 'Bahadurabad', 'Tariq Road', 'Burns Road', 'Boat Basin'] },
  lahore: { label: 'Lahore', areas: ['Gulberg', 'DHA', 'Johar Town', 'Model Town', 'Walled City', 'MM Alam Road', 'Liberty Market', 'Bahria Town', 'Anarkali', 'Fort Road'] },
  islamabad: { label: 'Islamabad', areas: ['F-6', 'F-7', 'F-10', 'G-9', 'Blue Area', 'E-11', 'Saidpur Village', 'Centaurus', 'Bahria Town', 'I-8'] },
};
export const CITY_SLUGS = Object.keys(CITIES);
export const parseCity = (v) => (CITY_SLUGS.includes(String(v)) ? String(v) : '');

export const PRIOR_MEAN = 4.2;
export const PRIOR_VOTES = 100;
export const MIN_REVIEWS = 50;
export const TOP_N = 20;
export const MAX_AGE_DAYS = 30;

/** Bayesian average: a rating counts for more the more reviews stand behind it. A 5.0 from 3 reviews cannot beat 4.6 from 4,000. */
export function placeScore(rating, reviews, mean = PRIOR_MEAN, votes = PRIOR_VOTES) {
  const r = Number(rating), n = Number(reviews);
  if (!Number.isFinite(r) || !Number.isFinite(n) || n < 0 || r < 1 || r > 5) return null;
  return Math.round(((n / (n + votes)) * r + (votes / (n + votes)) * mean) * 1000) / 1000;
}

/** Keeps only open restaurants with a real rating and enough reviews. Missing values are dropped, never turned into zero. */
export function eligible(p, minReviews = MIN_REVIEWS) {
  if (!p || typeof p.id !== 'string' || !p.id || !p.name) return false;
  if (typeof p.rating !== 'number' || typeof p.reviews !== 'number') return false;
  if (p.reviews < minReviews) return false;
  if (p.status && p.status !== 'OPERATIONAL') return false;
  return placeScore(p.rating, p.reviews) !== null;
}

/** Best first. Ties go to more reviews, then name. Duplicate places collapse to one. */
export function topPlaces(list, n = TOP_N) {
  const seen = new Map();
  for (const p of list) if (eligible(p) && !seen.has(p.id)) seen.set(p.id, { ...p, score: placeScore(p.rating, p.reviews) });
  return [...seen.values()]
    .sort((a, b) => b.score - a.score || b.reviews - a.reviews || a.name.localeCompare(b.name))
    .slice(0, n);
}

export const isFresh = (observedAt, now = Date.now(), maxDays = MAX_AGE_DAYS) => {
  const t = new Date(observedAt).getTime();
  return Number.isFinite(t) && now - t <= maxDays * 86400000;
};

export const searchPlan = (maxRequests) => {
  const plan = [];
  const max = Math.max(1, Math.trunc(maxRequests) || 1);
  for (let i = 0; plan.length < max; i++) {
    let added = false;
    for (const slug of CITY_SLUGS) {
      const area = CITIES[slug].areas[i];
      if (area && plan.length < max) { plan.push({ city: slug, area, text: `restaurants in ${area}, ${CITIES[slug].label}, Pakistan` }); added = true; }
    }
    if (!added) break;
  }
  return plan;
};
