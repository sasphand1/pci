// The single list of public endpoints. The router and the OpenAPI document are both built from it,
// so a route cannot exist without documentation and documentation cannot describe a missing route.

export type Param = { name: string; in: 'path' | 'query'; required?: boolean; description: string; schema: Record<string, unknown> };
export type Endpoint = { id: string; path: string; summary: string; description: string; params: Param[]; ok: string; notFound?: boolean };

const scopeParam: Param = { name: 'scope', in: 'path', required: true, description: 'A ranking scope: wheel.subscribed, wheel.viewed, wheel.active, youtube.subscribed, instagram.followers or category.<slug>.', schema: { type: 'string', pattern: '^(wheel\\.(subscribed|viewed|active)|youtube\\.subscribed|instagram\\.followers|category\\.[a-z0-9-]{2,60})$' } };

export const ENDPOINTS: Endpoint[] = [
  { id: 'status', path: '/status', summary: 'Publication status', description: 'When each ranking was last published and whether any is older than 36 hours.', params: [], ok: 'Status' },
  { id: 'wheel', path: '/wheel', summary: 'The three wheel rankings', description: 'Most Subscribed, Most Viewed and Most Active, 12 cards each. Only published rankings are shown.', params: [], ok: 'WheelResponse' },
  { id: 'rows', path: '/rows', summary: 'Platform and category rows', description: 'Top 15 for YouTube and Instagram, and for every category that has a published ranking.', params: [], ok: 'RowsResponse' },
  { id: 'ranking', path: '/rankings/:scope', summary: 'One published ranking', description: 'Up to 100 entries of a single published ranking, for example the Top 100.', params: [scopeParam, { name: 'limit', in: 'query', description: 'Number of entries, 1 to 100 (default 100).', schema: { type: 'integer', minimum: 1, maximum: 100, default: 100 } }], ok: 'Ranking', notFound: true },
  { id: 'categories', path: '/categories', summary: 'Categories', description: 'Active categories with the number of people in each and whether a ranking is published.', params: [], ok: 'CategoriesResponse' },
  { id: 'people', path: '/people', summary: 'People directory', description: 'People in the bucket, best published position first.', params: [
    { name: 'search', in: 'query', description: 'Part of a name.', schema: { type: 'string', maxLength: 100 } },
    { name: 'category', in: 'query', description: 'Category slug.', schema: { type: 'string', pattern: '^[a-z0-9-]{2,60}$' } },
    { name: 'page', in: 'query', description: 'Page number (default 1).', schema: { type: 'integer', minimum: 1, default: 1 } },
    { name: 'limit', in: 'query', description: 'Page size, 1 to 100 (default 25).', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } }], ok: 'PeopleResponse' },
  { id: 'person', path: '/people/:slug', summary: 'One person', description: 'Accounts with fresh numbers (no older than 7 days) and the published positions this person holds.', params: [
    { name: 'slug', in: 'path', required: true, description: 'The person\'s slug.', schema: { type: 'string', pattern: '^[a-z0-9-]{2,60}$' } }], ok: 'PersonResponse', notFound: true }
];

export const openapiPath = (p: string) => p.replace(/:([A-Za-z]+)/g, '{$1}');

type Handler = (...args: any[]) => unknown;
/** Registers exactly the documented endpoints. Throws at start-up if a handler is missing or undocumented. */
export function registerEndpoints(router: { get: (path: string, h: Handler) => unknown }, handlers: Record<string, Handler>, endpoints: Endpoint[] = ENDPOINTS): void {
  const ids = new Set(endpoints.map(e => e.id));
  for (const id of Object.keys(handlers)) if (!ids.has(id)) throw new Error(`Handler "${id}" has no documented endpoint`);
  for (const e of endpoints) { const h = handlers[e.id]; if (!h) throw new Error(`Endpoint "${e.id}" has no handler`); router.get(e.path, h); }
}
