import type {MetadataRoute} from 'next';
import {pubGet, pubList, type PubCategory, type PubPerson} from '@/lib/public';
import {canonicalPath} from '@/lib/seo';

/** Live, curated discovery only: never publish made-up profile URLs. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ['', 'creators', 'rankings', 'categories', 'compare', 'wall', 'satellite',
    'methodology', 'about', 'privacy', 'terms', 'contact', 'license', 'legal-notice', 'events'];
  const entries: MetadataRoute.Sitemap = pages.map(path => ({
    url: canonicalPath(path),
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : path === 'creators' || path === 'rankings' ? 0.8 : 0.5,
  }));

  const [categories, first] = await Promise.all([
    pubGet<PubCategory[]>('/categories'),
    pubList<PubPerson>('/people?page=1&limit=25'),
  ]);
  const validSlug = (slug: string) => /^[a-z0-9-]{2,60}$/.test(slug);
  for (const category of categories ?? []) {
    if (validSlug(category.slug)) entries.push({url: canonicalPath(`/categories/${category.slug}`), changeFrequency: 'weekly', priority: 0.7});
  }
  if (first) {
    const people = [...first.data];
    // Bounded: protect sitemap generation from damaged pagination or runaway API calls.
    const count = Math.min(Math.max(first.pagination.pages || 1, 1), 40);
    for (let page = 2; page <= count; page++) {
      const result = await pubList<PubPerson>(`/people?page=${page}&limit=25`);
      if (!result) break;
      people.push(...result.data);
    }
    const unique = new Set<string>();
    for (const person of people) {
      if (!validSlug(person.slug) || unique.has(person.slug)) continue;
      unique.add(person.slug);
      entries.push({url: canonicalPath(`/creators/${person.slug}`), changeFrequency: 'daily', priority: 0.7});
    }
  }
  return entries;
}
