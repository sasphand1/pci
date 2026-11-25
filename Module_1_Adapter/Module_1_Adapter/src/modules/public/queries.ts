import { query } from '../../lib/db.js';
import {monthlyEstimates,instagramSponsorScenarios,personAnalytics} from '../creator-analytics/data.js';
import { FRESHNESS_DAYS_DEFAULT } from '../../engine/index.js';
import { safeAvatarUrl } from '../../providers/avatar.js';
import { cachedAvatarUrl } from '../ingest/avatar-cache-rules.js';
import { accountUrl, isStale, scopeInfo, toEntries, type PublicEntry, type SlotRow } from './shape.js';

export type PublicPerson = { slug: string; displayName: string; avatarUrl: string | null; estimatedMonthlyEarningsUsd?:number|null; earningsStatus?:'ready'|'needs_history'|'no_view_data'|'stale'|'invalid'|'no_youtube'; earningsBasis?:'observed_view_gain'|'recent_uploads_floor'|null; instagramSponsorScenarioUsd?:number|null; categories: { slug: string; label: string }[]; accounts: { platform: string; handle: string; url: string | null }[] };
export type Ranking = { scope: string; kind: string; label: string; unit: string; publishedAt: string | null; stale: boolean; population: number; covered: number; entries: PublicEntry<PublicPerson>[] };
type Pointer = { scope: string; runId: string; publishedAt: string | null; population: number };

export async function pointers(scopes?: string[]): Promise<Pointer[]> {
  const r = await query(`SELECT p.scope, r.id AS "runId", r.published_at AS "publishedAt", COALESCE((r.diagnostics->>'population')::int,0) AS population
    FROM published_pointers p JOIN rank_runs r ON r.id=p.run_id WHERE r.status='published' ${scopes ? 'AND p.scope = ANY($1::text[])' : ''} ORDER BY p.scope`, scopes ? [scopes] : []);
  return r.rows.map((x: any) => ({ scope: x.scope, runId: x.runId, publishedAt: x.publishedAt ? new Date(x.publishedAt).toISOString() : null, population: x.population }));
}

export async function categoryLabels(): Promise<Map<string, { label: string; order: number }>> {
  const r = await query('SELECT slug,label,display_order AS "order" FROM categories WHERE active=true');
  return new Map(r.rows.map((x: any) => [x.slug, { label: x.label, order: x.order }]));
}

export async function peopleByIds(ids: string[]): Promise<Map<string, PublicPerson>> {
  const out = new Map<string, PublicPerson>(); if (!ids.length) return out;
  const [p, a, c] = await Promise.all([
    query('SELECT id,slug,display_name FROM people WHERE id = ANY($1::uuid[])', [ids]),
    query('SELECT a.id,a.person_id,a.platform,a.external_id,a.handle,a.avatar_url,c.fetched_at AS cached_at FROM accounts a LEFT JOIN avatar_cache c ON c.account_id=a.id AND c.source_url=a.avatar_url WHERE a.person_id = ANY($1::uuid[]) ORDER BY a.platform', [ids]),
    query(`SELECT pc.person_id,c.slug,c.label FROM person_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.person_id = ANY($1::uuid[]) AND c.active=true ORDER BY pc.is_primary DESC, c.label`, [ids])
  ]);
  for (const r of p.rows) out.set(r.id, { slug: r.slug, displayName: r.display_name, avatarUrl: null, categories: [], accounts: [] });
  for (const r of a.rows) { const x = out.get(r.person_id); if (!x) continue;
    x.accounts.push({ platform: r.platform, handle: r.handle, url: accountUrl(r.platform, r.external_id, r.handle) });
    if (!x.avatarUrl) x.avatarUrl = (r.cached_at ? cachedAvatarUrl(process.env.PCI_PUBLIC_API_URL, r.id, r.cached_at) : null) ?? safeAvatarUrl(r.avatar_url); }
  for (const r of c.rows) out.get(r.person_id)?.categories.push({ slug: r.slug, label: r.label });
  return out;
}

/** rank_slots.breakdown is stored as {linked, counted, contributions}; the public shape wants just the contributions. */
function contributionsOf(b: unknown): { platform: string; value: number }[] {
  if (Array.isArray(b)) return b;
  const c = (b as { contributions?: unknown } | null)?.contributions;
  return Array.isArray(c) ? c : [];
}

async function slotsFor(runIds: string[], limit: number): Promise<Map<string, { rows: SlotRow[]; total: number }>> {
  const out = new Map<string, { rows: SlotRow[]; total: number }>(); if (!runIds.length) return out;
  const r = await query(`SELECT * FROM (SELECT run_id, slot, rank, person_id, value::text AS value, breakdown,
      (count(*) OVER (PARTITION BY run_id, rank)) > 1 AS tied, (count(*) OVER (PARTITION BY run_id))::int AS total
      FROM rank_slots WHERE run_id = ANY($1::uuid[])) t WHERE slot <= $2 ORDER BY run_id, slot`, [runIds, limit]);
  for (const x of r.rows) {
    const e: { rows: SlotRow[]; total: number } = out.get(x.run_id) ?? { rows: [], total: x.total }; e.total = x.total;
    e.rows.push({ slot: x.slot, rank: x.rank, personId: x.person_id, value: x.value, tied: x.tied, breakdown: contributionsOf(x.breakdown) });
    out.set(x.run_id, e);
  }
  return out;
}

/** Published rankings for the given scopes. A scope with nothing published comes back with no entries and no date. */
export async function rankings(scopes: string[], limit: number, now = new Date(), labels?: Map<string, { label: string; order: number }>): Promise<Ranking[]> {
  const ptrs = new Map((await pointers(scopes)).map(p => [p.scope, p]));
  const slots = await slotsFor([...ptrs.values()].map(p => p.runId), limit);
  const ids = new Set<string>(); for (const s of slots.values()) for (const r of s.rows) ids.add(r.personId);
  const people = await peopleByIds([...ids]);
  if (scopes.some(scope=>scope.startsWith('wheel.'))) {
    const [estimates,instagram]=await Promise.all([monthlyEstimates([...ids],now),instagramSponsorScenarios([...ids],now)]);
    for(const [id,person] of people) {
      person.estimatedMonthlyEarningsUsd=estimates.get(id)?.estimate?.usd??null;
      person.earningsStatus=estimates.get(id)?.status??'no_youtube';
      person.earningsBasis=estimates.get(id)?.basis??null;
      person.instagramSponsorScenarioUsd=instagram.get(id)?.usd??null;
    }
  }
  const cats = labels ?? await categoryLabels();
  const out: Ranking[] = [];
  for (const scope of scopes) {
    const info = scopeInfo(scope, cats.get(scope.slice(9))?.label); if (!info) continue;
    const p = ptrs.get(scope), s = p ? slots.get(p.runId) : undefined;
    out.push({ ...info, publishedAt: p?.publishedAt ?? null, stale: isStale(p?.publishedAt ?? null, now), population: p?.population ?? 0, covered: s?.total ?? 0, entries: toEntries(s?.rows ?? [], people) });
  }
  return out;
}

export async function peopleCount(): Promise<number> { return Number((await query('SELECT count(*)::int AS n FROM people')).rows[0].n); }

export async function categoryList() {
  const r = await query(`SELECT c.slug,c.label,c.description,(SELECT count(*)::int FROM person_categories pc WHERE pc.category_id=c.id) AS people,
      EXISTS(SELECT 1 FROM published_pointers p WHERE p.scope='category.'||c.slug) AS "hasRanking"
    FROM categories c WHERE c.active=true ORDER BY c.display_order, c.label`);
  return r.rows.map((x: any) => ({ slug: x.slug, label: x.label, description: x.description || null, people: x.people, hasRanking: x.hasRanking }));
}

export async function directory(opts: { search?: string; category?: string; page: number; limit: number; pattern?: string }) {
  const where: string[] = []; const v: unknown[] = [];
  if (opts.pattern) { v.push(opts.pattern); where.push(`p.display_name ILIKE $${v.length} ESCAPE '\\'`); }
  if (opts.category) { v.push(opts.category); where.push(`EXISTS (SELECT 1 FROM person_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.person_id=p.id AND c.slug=$${v.length} AND c.active=true)`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number((await query(`SELECT count(*)::int AS n FROM people p ${w}`, v)).rows[0].n);
  v.push(opts.limit, (opts.page - 1) * opts.limit);
  const r = await query(`SELECT p.id FROM people p
    LEFT JOIN published_pointers pp ON pp.scope='wheel.subscribed'
    LEFT JOIN rank_slots rs ON rs.run_id=pp.run_id AND rs.person_id=p.id
    ${w} ORDER BY rs.slot NULLS LAST, lower(p.display_name), p.id LIMIT $${v.length - 1} OFFSET $${v.length}`, v);
  const ids = r.rows.map((x: any) => x.id as string), people = await peopleByIds(ids);
  return { total, data: ids.map(i => people.get(i)).filter((x): x is PublicPerson => !!x) };
}

export async function personDetail(slug: string) {
  const p = await query('SELECT id FROM people WHERE slug=$1', [slug]); if (!p.rowCount) return null;
  const id = p.rows[0].id as string;
  const base = (await peopleByIds([id])).get(id); if (!base) return null;
  const [obs, pos, acc] = await Promise.all([
    query(`SELECT DISTINCT ON (o.account_id, o.metric) o.account_id AS "accountId", o.metric, o.value::text AS value, o.observed_at AS "observedAt"
      FROM hub_account_metrics o JOIN accounts a ON a.id=o.account_id
      WHERE a.person_id=$1 AND o.observed_at > now() - make_interval(days => $2) ORDER BY o.account_id, o.metric, o.observed_at DESC`, [id, FRESHNESS_DAYS_DEFAULT]),
    query(`SELECT pp.scope, s.slot, s.rank, s.value::text AS value FROM published_pointers pp JOIN rank_slots s ON s.run_id=pp.run_id WHERE s.person_id=$1 ORDER BY pp.scope`, [id]),
    query('SELECT id,platform,handle,external_id FROM accounts WHERE person_id=$1 ORDER BY platform', [id])
  ]);
  const cats = await categoryLabels();
  const fig = new Map<string, { followers: number | null; views: number | null; posts30d: number | null; observedAt: string | null }>();
  for (const o of obs.rows) {
    const f = fig.get(o.accountId) ?? { followers: null, views: null, posts30d: null, observedAt: null };
    if (o.metric === 'followers') f.followers = Number(o.value); else if (o.metric === 'views') f.views = Number(o.value); else if (o.metric === 'posts_30d') f.posts30d = Number(o.value);
    const t = new Date(o.observedAt).toISOString(); if (!f.observedAt || t > f.observedAt) f.observedAt = t;
    fig.set(o.accountId, f);
  }
  const accounts = acc.rows.map((a: any) => ({ platform: a.platform, handle: a.handle, url: accountUrl(a.platform, a.external_id, a.handle), ...(fig.get(a.id) ?? { followers: null, views: null, posts30d: null, observedAt: null }) }));
  const positions = pos.rows.map((x: any) => { const i = scopeInfo(x.scope, cats.get(x.scope.slice(9))?.label); return i ? { scope: x.scope, label: i.label, unit: i.unit, slot: x.slot, rank: x.rank, value: Number(x.value) } : null; }).filter(Boolean);
  const analytics=await personAnalytics(id);
  const similar=await query<{slug:string;displayName:string}>(`SELECT DISTINCT p2.slug,p2.display_name AS "displayName"
    FROM person_categories mine JOIN person_categories shared ON shared.category_id=mine.category_id
    JOIN people p2 ON p2.id=shared.person_id WHERE mine.person_id=$1 AND p2.id<>$1
    ORDER BY p2.display_name,p2.slug LIMIT 4`,[id]);
  return { slug, displayName: base.displayName, avatarUrl: base.avatarUrl, categories: base.categories, accounts, positions, analytics, similarCreators:similar.rows };
}
