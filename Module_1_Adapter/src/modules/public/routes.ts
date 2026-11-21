import { Router } from 'express';
import { z } from 'zod';
import { handler, HttpError } from '../../lib/errors.js';
import { registerEndpoints } from './endpoints.js';
import { categoryList, categoryLabels, directory, peopleCount, personDetail, pointers, rankings } from './queries.js';
import { PLATFORM_SCOPES, ROW_SIZE, SCOPE_RE, WHEEL_CARDS, WHEEL_SCOPES, isStale, likePattern, pageOf } from './shape.js';

export const publicRankingRoutes = Router();

// Read-only and identical for everyone, so browsers and proxies may keep it briefly.
publicRankingRoutes.use((_req, res, next) => { res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60'); next(); });

const rankingQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(100) });
const peopleQuery = z.object({
  search: z.string().trim().max(100).optional(), category: z.string().regex(/^[a-z0-9-]{2,60}$/).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1), limit: z.coerce.number().int().min(1).max(100).default(25)
});

registerEndpoints(publicRankingRoutes, {
  status: handler(async (_req, res) => {
    const now = new Date(), ps = await pointers();
    const newest = ps.map(p => p.publishedAt).filter((x): x is string => !!x).sort().pop() ?? null;
    res.json({ data: { publishedAt: newest, stale: ps.length === 0 || ps.some(p => isStale(p.publishedAt, now)), people: await peopleCount(),
      scopes: ps.map(p => ({ scope: p.scope, publishedAt: p.publishedAt, stale: isStale(p.publishedAt, now), covered: p.population })) } });
  }),
  wheel: handler(async (_req, res) => { res.json({ data: { sorts: await rankings([...WHEEL_SCOPES], WHEEL_CARDS) } }); }),
  rows: handler(async (_req, res) => {
    const labels = await categoryLabels();
    const catScopes = (await pointers()).map(p => p.scope).filter(s => s.startsWith('category.') && labels.has(s.slice(9)))
      .sort((a, b) => (labels.get(a.slice(9))!.order - labels.get(b.slice(9))!.order) || labels.get(a.slice(9))!.label.localeCompare(labels.get(b.slice(9))!.label));
    const all = await rankings([...PLATFORM_SCOPES, ...catScopes], ROW_SIZE, new Date(), labels);
    res.json({ data: { platforms: all.filter(r => r.kind === 'platform'), categories: all.filter(r => r.kind === 'category' && r.entries.length) } });
  }),
  ranking: handler(async (req, res) => {
    const scope = String(req.params.scope);
    if (!SCOPE_RE.test(scope)) throw new HttpError(400, 'BAD_SCOPE', 'Unknown ranking');
    const { limit } = rankingQuery.parse(req.query);
    const [r] = await rankings([scope], limit);
    if (!r || !r.publishedAt) throw new HttpError(404, 'NOT_PUBLISHED', 'This ranking has not been published');
    res.json({ data: r });
  }),
  categories: handler(async (_req, res) => { res.json({ data: await categoryList() }); }),
  people: handler(async (req, res) => {
    const q = peopleQuery.parse(req.query);
    const r = await directory({ ...q, pattern: q.search ? likePattern(q.search) : undefined });
    res.json({ data: r.data, pagination: pageOf(q.page, q.limit, r.total) });
  }),
  person: handler(async (req, res) => {
    const slug = z.string().regex(/^[a-z0-9-]{2,60}$/).parse(req.params.slug);
    const d = await personDetail(slug);
    if (!d) throw new HttpError(404, 'NOT_FOUND', 'Person not found');
    res.json({ data: d });
  })
});
