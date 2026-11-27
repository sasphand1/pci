import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../lib/db.js';
import { handler } from '../../lib/errors.js';
import { monthlyEstimates, instagramSponsorScenarios, personAnalytics } from '../creator-analytics/data.js';
import { peopleByIds, categoryLabels } from './queries.js';
import { likePattern, scopeInfo } from './shape.js';
import { isStaleAsOf, latestAsOf, parsePlatform, parseSlugs, parseSort, totalFollowers, type Fig } from './creator-index-rules.js';

/** Public, read-only creator directory with each creator's LAST KNOWN figures and the date they are from. */
export const creatorIndexRoutes = Router();
creatorIndexRoutes.use((_req, res, next) => { res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120'); next(); });

const q = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().regex(/^[a-z0-9-]{2,60}$/).optional(),
  platform: z.string().optional(), sort: z.string().optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(24),
  slugs: z.string().max(300).optional(), detail: z.enum(['0', '1']).default('0'),
});

async function pageIds(o: { search?: string; category?: string; platform: string; sort: string; page: number; limit: number }) {
  const where: string[] = []; const v: unknown[] = [];
  if (o.search) { v.push(likePattern(o.search)); where.push(`(p.display_name ILIKE $${v.length} ESCAPE '\\' OR EXISTS (SELECT 1 FROM accounts a WHERE a.person_id=p.id AND a.platform IN ('youtube','instagram') AND a.handle ILIKE $${v.length} ESCAPE '\\'))`); }
  if (o.category) { v.push(o.category); where.push(`EXISTS (SELECT 1 FROM person_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.person_id=p.id AND c.slug=$${v.length} AND c.active=true)`); }
  if (o.platform) { v.push(o.platform); where.push(`EXISTS (SELECT 1 FROM accounts a WHERE a.person_id=p.id AND a.platform=$${v.length})`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const order = o.sort === 'followers' ? 'f.total DESC NULLS LAST, lower(p.display_name), p.id'
    : o.sort === 'name' ? 'lower(p.display_name), p.id' : 'rs.slot NULLS LAST, f.total DESC NULLS LAST, lower(p.display_name), p.id';
  const from = `FROM people p
    LEFT JOIN published_pointers pp ON pp.scope='wheel.subscribed'
    LEFT JOIN rank_slots rs ON rs.run_id=pp.run_id AND rs.person_id=p.id
    LEFT JOIN LATERAL (SELECT sum(x.v) AS total FROM (SELECT DISTINCT ON (a.id) o2.value AS v FROM accounts a
      JOIN hub_account_metrics o2 ON o2.account_id=a.id AND o2.metric='followers' WHERE a.person_id=p.id
      ORDER BY a.id, o2.observed_at DESC) x) f ON true`;
  const total = Number((await query(`SELECT count(*)::int AS n FROM people p ${w}`, v)).rows[0].n);
  v.push(o.limit, (o.page - 1) * o.limit);
  const r = await query(`SELECT p.id, rs.rank ${from} ${w} ORDER BY ${order} LIMIT $${v.length - 1} OFFSET $${v.length}`, v);
  return { total, rows: r.rows as { id: string; rank: number | null }[] };
}

async function lastKnown(ids: string[]) {
  const out = new Map<string, Map<string, Fig & { handle: string }>>();
  if (!ids.length) return out;
  const r = await query(`SELECT a.person_id AS pid, a.id AS aid, a.platform, a.handle, o.metric, o.value::text AS value, o.observed_at AS at
    FROM accounts a LEFT JOIN LATERAL (
      SELECT DISTINCT ON (metric) metric, value, observed_at FROM hub_account_metrics
      WHERE account_id=a.id AND metric IN ('followers','views','posts_30d') ORDER BY metric, observed_at DESC) o ON true
    WHERE a.person_id = ANY($1::uuid[]) AND a.platform IN ('youtube','instagram')`, [ids]);
  for (const x of r.rows) {
    const m = out.get(x.pid) ?? new Map(); out.set(x.pid, m);
    const f = m.get(x.aid) ?? { platform: x.platform, handle: x.handle, followers: null, views: null, posts30d: null, asOf: null };
    if (x.metric) {
      const n = Number(x.value); const val = Number.isFinite(n) && n >= 0 ? n : null;
      if (x.metric === 'followers') f.followers = val; else if (x.metric === 'views') f.views = val; else if (x.metric === 'posts_30d') f.posts30d = val;
      const t = new Date(x.at).toISOString(); if (!f.asOf || t > f.asOf) f.asOf = t;
    }
    m.set(x.aid, f);
  }
  return out;
}

async function build(ids: string[], ranks: Map<string, number | null>, detail: boolean) {
  const [people, figs, est, ig, labels] = await Promise.all([
    peopleByIds(ids), lastKnown(ids), monthlyEstimates(ids), instagramSponsorScenarios(ids), categoryLabels()]);
  const now = Date.now();
  const out = [];
  for (const id of ids) {
    const p = people.get(id); if (!p) continue;
    const accFigs = [...(figs.get(id)?.values() ?? [])];
    const urls = new Map(p.accounts.map(a => [`${a.platform}:${a.handle}`, a.url]));
    const asOf = latestAsOf(accFigs);
    const row: Record<string, unknown> = {
      slug: p.slug, displayName: p.displayName, avatarUrl: p.avatarUrl, categories: p.categories,
      rank: ranks.get(id) ?? null, totalFollowers: totalFollowers(accFigs), asOf, stale: isStaleAsOf(asOf, now),
      accounts: accFigs.map(f => ({ platform: f.platform, handle: f.handle, url: urls.get(`${f.platform}:${f.handle}`) ?? null,
        followers: f.followers, views: f.views, posts30d: f.posts30d, asOf: f.asOf })),
      earningsUsd: est.get(id)?.estimate?.usd ?? null, earningsStatus: est.get(id)?.status ?? 'no_youtube', earningsBasis: est.get(id)?.basis ?? null,
      instagramSponsorScenarioUsd: ig.get(id)?.usd ?? null,
    };
    if (detail) {
      const a = await personAnalytics(id);
      row.growth = { subscribers: a.growth.subscribers, views: a.growth.views };
      const pos = await query('SELECT pp.scope, s.rank, s.value::text AS value FROM published_pointers pp JOIN rank_slots s ON s.run_id=pp.run_id WHERE s.person_id=$1 ORDER BY pp.scope', [id]);
      row.positions = pos.rows.map((x: any) => { const i = scopeInfo(x.scope, labels.get(x.scope.slice(9))?.label); return i ? { scope: x.scope, label: i.label, unit: i.unit, rank: x.rank, value: Number(x.value) } : null; }).filter(Boolean);
    }
    out.push(row);
  }
  return out;
}

creatorIndexRoutes.get('/', handler(async (req, res) => {
  const a = q.parse(req.query);
  const slugs = parseSlugs(a.slugs);
  if (a.slugs !== undefined) {
    const r = slugs.length ? await query('SELECT p.id, p.slug, rs.rank FROM people p LEFT JOIN published_pointers pp ON pp.scope=\'wheel.subscribed\' LEFT JOIN rank_slots rs ON rs.run_id=pp.run_id AND rs.person_id=p.id WHERE p.slug = ANY($1::text[])', [slugs]) : { rows: [] as any[] };
    const bySlug = new Map(r.rows.map((x: any) => [x.slug, x]));
    const ordered = slugs.map(s => bySlug.get(s)).filter(Boolean) as { id: string; rank: number | null }[];
    const data = await build(ordered.map(x => x.id), new Map(ordered.map(x => [x.id, x.rank])), a.detail === '1');
    res.json({ data });
    return;
  }
  const { total, rows } = await pageIds({ search: a.search, category: a.category, platform: parsePlatform(a.platform), sort: parseSort(a.sort), page: a.page, limit: a.limit });
  const data = await build(rows.map(x => x.id), new Map(rows.map(x => [x.id, x.rank])), false);
  const counts = await query(`SELECT (SELECT count(*)::int FROM people) AS creators,
    (SELECT count(DISTINCT person_id)::int FROM accounts WHERE platform='youtube') AS youtube,
    (SELECT count(DISTINCT person_id)::int FROM accounts WHERE platform='instagram') AS instagram`);
  res.json({ data, pagination: { page: a.page, limit: a.limit, total, pages: Math.max(1, Math.ceil(total / a.limit)) }, totals: counts.rows[0] });
}));
