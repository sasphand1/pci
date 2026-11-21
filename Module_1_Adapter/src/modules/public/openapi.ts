import { ENDPOINTS, openapiPath, type Endpoint } from './endpoints.js';

const ref = (n: string) => ({ $ref: `#/components/schemas/${n}` });
const str = { type: 'string' }, int = { type: 'integer' }, bool = { type: 'boolean' };
const nstr = { type: 'string', nullable: true };
const arr = (items: unknown) => ({ type: 'array', items });
const obj = (properties: Record<string, unknown>, required?: string[]) => ({ type: 'object', properties, required: required ?? Object.keys(properties) });
const envelope = (data: unknown) => obj({ data }, ['data']);

export const schemas: Record<string, unknown> = {
  Account: obj({ platform: { type: 'string', enum: ['youtube', 'instagram'] }, handle: str, url: nstr }),
  Category: obj({ slug: str, label: str }),
  Person: obj({ slug: str, displayName: str, avatarUrl: nstr, categories: arr(ref('Category')), accounts: arr(ref('Account')) }),
  Contribution: obj({ platform: str, value: int }),
  Entry: obj({ slot: { ...int, description: 'Unique position 1..N, no gaps.' }, rank: { ...int, description: 'Competition rank. Equal values share a rank.' }, tied: bool, value: int, counted: { ...int, description: 'How many accounts supplied a fresh number.' }, contributions: arr(ref('Contribution')), person: ref('Person') }),
  Ranking: obj({ scope: str, kind: { type: 'string', enum: ['wheel', 'platform', 'category'] }, label: str, unit: str, publishedAt: nstr, stale: bool, population: int, covered: int, entries: arr(ref('Entry')) }),
  WheelResponse: envelope(obj({ sorts: arr(ref('Ranking')) })),
  RowsResponse: envelope(obj({ platforms: arr(ref('Ranking')), categories: arr(ref('Ranking')) })),
  Ranking_: envelope(ref('Ranking')),
  CategoryItem: obj({ slug: str, label: str, description: nstr, people: int, hasRanking: bool }),
  CategoriesResponse: envelope(arr(ref('CategoryItem'))),
  Pagination: obj({ page: int, limit: int, total: int, pages: int }),
  PeopleResponse: obj({ data: arr(ref('Person')), pagination: ref('Pagination') }),
  AccountFigures: obj({ platform: str, handle: str, url: nstr, followers: { type: 'integer', nullable: true }, views: { type: 'integer', nullable: true }, posts30d: { type: 'integer', nullable: true }, observedAt: nstr }),
  Position: obj({ scope: str, label: str, unit: str, slot: int, rank: int, value: int }),
  PersonDetail: obj({ slug: str, displayName: str, avatarUrl: nstr, categories: arr(ref('Category')), accounts: arr(ref('AccountFigures')), positions: arr(ref('Position')) }),
  PersonResponse: envelope(ref('PersonDetail')),
  Status: envelope(obj({ publishedAt: nstr, stale: bool, people: int, scopes: arr(obj({ scope: str, publishedAt: nstr, stale: bool, covered: int })) })),
  Error: obj({ error: obj({ code: str, message: str }) })
};

function operation(e: Endpoint) {
  const responses: Record<string, unknown> = {
    '200': { description: 'OK', content: { 'application/json': { schema: ref(e.ok === 'Ranking' ? 'Ranking_' : e.ok) } } },
    '429': { description: 'Too many requests', content: { 'application/json': { schema: ref('Error') } } }
  };
  if (e.notFound || e.params.some(p => p.in === 'path')) responses['404'] = { description: 'Not found', content: { 'application/json': { schema: ref('Error') } } };
  if (e.params.length) responses['400'] = { description: 'Invalid parameter', content: { 'application/json': { schema: ref('Error') } } };
  return { operationId: e.id, summary: e.summary, description: e.description, tags: ['Public rankings'],
    parameters: e.params.map(p => ({ name: p.name, in: p.in, required: p.required === true, description: p.description, schema: p.schema })), responses };
}

export function buildSpec(endpoints: Endpoint[] = ENDPOINTS) {
  const paths: Record<string, unknown> = {};
  for (const e of endpoints) paths[openapiPath(e.path)] = { get: operation(e) };
  return {
    openapi: '3.0.3',
    info: { title: 'Pakistan Creator Index public API', version: '1.0.0',
      description: 'Read-only. Everything here comes from rankings that were published after passing the safety checks. Nothing is calculated when you ask. The numbers are the ones YouTube and Instagram report, added across a person\'s accounts, not unique people.' },
    servers: [{ url: '/api/v1/public' }],
    tags: [{ name: 'Public rankings' }],
    paths,
    components: { schemas }
  };
}
