/** OpenAPI 3 description of the Data Hub admin endpoints (mounted under /api/v1/admin).
 * Served to signed-in admins at GET /api/v1/admin/ingest/openapi.json and kept in sync with the routes by tests. */
type Op = { method: 'get' | 'post' | 'patch'; path: string; summary: string; roles: string; body?: Record<string, unknown>; params?: Record<string, unknown>[] };

const json = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, properties });
const int = (min: number, max: number, def?: number) => ({ type: 'integer', minimum: min, maximum: max, ...(def !== undefined ? { default: def } : {}) });
const pathId = (name: string, format = 'uuid') => ({ name, in: 'path', required: true, schema: { type: 'string', format } });

export const HUB_OPERATIONS: Op[] = [
  { method: 'get', path: '/ingest/health', summary: 'Source health, open alerts, recent jobs, disagreements and what is stored per category', roles: 'any admin' },
  { method: 'get', path: '/ingest/alerts', summary: 'Hub alerts (open or all)', roles: 'any admin', params: [{ name: 'state', in: 'query', schema: { type: 'string', enum: ['open', 'all'], default: 'open' } }] },
  { method: 'get', path: '/ingest/discrepancies', summary: 'Last 100 API vs web disagreements over 5%', roles: 'any admin' },
  { method: 'post', path: '/ingest/check', summary: 'Run the hub check now (also runs every 15 minutes)', roles: 'owner, editor' },
  { method: 'get', path: '/ingest/creators-bucket', summary: 'YouTube Creators Bucket coverage and recorded Hub data freshness', roles: 'any admin' },
  { method: 'get', path: '/ingest/coverage', summary: 'Accounts per platform by audience tier and category, with freshness', roles: 'any admin' },
  { method: 'get', path: '/ingest/account/{id}', summary: 'Everything the hub holds for one account', roles: 'any admin', params: [pathId('id')] },
  { method: 'get', path: '/ingest/compare', summary: 'Two or three accounts side by side', roles: 'any admin', params: [{ name: 'ids', in: 'query', required: true, description: '2 or 3 account ids, comma separated', schema: { type: 'string' } }] },
  { method: 'get', path: '/ingest/status', summary: 'Sources and stored row counts', roles: 'any admin' },
  { method: 'get', path: '/ingest/policies', summary: 'Refresh windows per platform', roles: 'any admin' },
  { method: 'post', path: '/ingest/backfill', summary: 'Copy existing collected data into the hub (no platform requests)', roles: 'owner, editor',
    body: json({ refreshRunId: { type: 'string', format: 'uuid' }, videos: { type: 'boolean', default: false }, historyDays: int(1, 7) }) },
  { method: 'patch', path: '/ingest/sources/{id}', summary: 'Kill switch for web (http) sources', roles: 'owner',
    params: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', enum: ['youtube.http', 'instagram.http', 'tiktok.http'] } }], body: json({ enabled: { type: 'boolean' } }) },
  { method: 'post', path: '/ingest/instagram/avatar/{accountId}', summary: 'Fill one missing Instagram picture from the public page', roles: 'owner, editor', params: [pathId('accountId')] },
  { method: 'post', path: '/ingest/instagram/avatars/graph/fill', summary: 'Recover missing Instagram pictures through the Meta API', roles: 'owner, editor', body: json({ limit: int(1, 5, 5) }) },
  { method: 'post', path: '/ingest/local/collect', summary: 'Collect the restaurant Top 20 from Google Places now', roles: 'owner, editor', body: json({ maxRequests: int(1, 60) }) },
  { method: 'post', path: '/ingest/instagram/avatars/cache', summary: 'Keep own copies of Instagram pictures', roles: 'owner, editor', body: json({ limit: int(1, 30, 20) }) },
  { method: 'post', path: '/ingest/instagram/avatars/fill', summary: 'Fill missing Instagram pictures from public pages', roles: 'owner, editor', body: json({ limit: int(1, 10, 5) }) },
  { method: 'post', path: '/ingest/tiktok/embed', summary: 'Store one TikTok video from its public embed', roles: 'owner, editor', body: json({ url: { type: 'string', format: 'uri', maxLength: 250 } }) },
  { method: 'get', path: '/ingest/openapi.json', summary: 'This document', roles: 'any admin' }
];

export function buildHubSpec() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const o of HUB_OPERATIONS) {
    const responses: Record<string, unknown> = { '200': { description: 'OK. Body: { "data": ... }' }, '401': { description: 'Not signed in' } };
    if (o.roles !== 'any admin') responses['403'] = { description: `Allowed roles: ${o.roles}` };
    if (o.body || o.params?.length) responses['400'] = { description: 'Invalid input' };
    (paths[o.path] ??= {})[o.method] = {
      summary: o.summary, description: `Roles: ${o.roles}.${o.method === 'get' ? '' : ' Needs the CSRF header.'}`, tags: ['Data Hub'],
      ...(o.params ? { parameters: o.params } : {}),
      ...(o.body ? { requestBody: { required: false, content: { 'application/json': { schema: o.body } } } } : {}),
      responses
    };
  }
  return {
    openapi: '3.0.3',
    info: { title: 'PCI Data Hub admin API', version: '2.0.0',
      description: 'The hub stores every collected reading once (official API first, web sources only as permitted fallback) and every ranking, profile and analytics view reads from it. Mounted under /api/v1/admin; requires an admin session.' },
    servers: [{ url: '/api/v1/admin' }],
    tags: [{ name: 'Data Hub' }],
    paths
  };
}
