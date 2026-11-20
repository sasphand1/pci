import type pg from 'pg';
import { query, transaction } from '../../lib/db.js';
import { HttpError } from '../../lib/errors.js';
import { classifyBatch, summarizeBatch, type ClassifyContext, type ResolveResult, type RowResult } from './classify.js';
import { normalizeName, parseAccountInput, parseBulk, MAX_BULK_ROWS, type Platform } from './parse.js';
import { makeResolver, mapLimit, type Resolver } from './resolver.js';
import { captureLive, republishWithout } from '../publish/service.js';

type Q = Pick<pg.PoolClient, 'query'>;

async function loadContext(db: Q, platform: Platform): Promise<Omit<ClassifyContext, 'resolutions' | 'platform'>> {
  const [accounts, people, cats] = await Promise.all([
    db.query<{ platform: string; external_id: string; person_id: string }>('SELECT platform, external_id, person_id FROM accounts'),
    db.query<{ id: string; slug: string; display_name: string }>('SELECT id, slug, display_name FROM people'),
    db.query<{ slug: string }>('SELECT slug FROM categories WHERE active = true')
  ]);
  const platformsOf = new Map<string, Set<Platform>>();
  for (const a of accounts.rows) { const s = platformsOf.get(a.person_id) ?? new Set<Platform>(); s.add(a.platform as Platform); platformsOf.set(a.person_id, s); }
  const peopleByName = new Map<string, { id: string; platforms: Set<Platform> }>();
  const peopleBySlug = new Map<string, { id: string; platforms: Set<Platform> }>();
  for (const p of people.rows) {
    const v = { id: p.id, platforms: platformsOf.get(p.id) ?? new Set<Platform>() };
    peopleByName.set(normalizeName(p.display_name), v); peopleBySlug.set(p.slug, v);
  }
  return {
    existingAccounts: new Set(accounts.rows.map(a => `${a.platform}:${a.external_id}`)),
    peopleByName, peopleBySlug, takenSlugs: new Set(people.rows.map(p => p.slug)),
    categorySlugs: new Set(cats.rows.map(c => c.slug))
  };
}

export async function previewBatch(platform: Platform, text: string, resolver: Resolver = makeResolver(), db: Q = { query } as unknown as Q) {
  const { rows, tooMany } = parseBulk(text);
  if (!rows.length) throw new HttpError(400, 'EMPTY_BATCH', 'Nothing to add');
  if (tooMany) throw new HttpError(400, 'TOO_MANY_ROWS', `At most ${MAX_BULK_ROWS} rows per batch`);
  const resolutions = new Map<number, ResolveResult>();
  // Instagram's Graph API is called one at a time (rate budget); YouTube lookups run a few in parallel.
  await mapLimit(rows, platform === 'youtube' ? 5 : 1, async row => {
    const parsed = parseAccountInput(platform, row.raw);
    if (parsed.ok) resolutions.set(row.index, await resolver.resolve(platform, parsed));
  });
  const ctx = await loadContext(db, platform);
  const results = classifyBatch(rows, { ...ctx, platform, resolutions });
  return { rows: results, summary: summarizeBatch(results) };
}

/** Preview again against fresh state, then insert every addable row. One bad row never blocks the others. */
export async function commitBatch(platform: Platform, text: string, actorId: string | null, resolver: Resolver = makeResolver()) {
  const { rows: parsedRows, tooMany } = parseBulk(text);
  if (!parsedRows.length) throw new HttpError(400, 'EMPTY_BATCH', 'Nothing to add');
  if (tooMany) throw new HttpError(400, 'TOO_MANY_ROWS', `At most ${MAX_BULK_ROWS} rows per batch`);
  const resolutions = new Map<number, ResolveResult>();
  await mapLimit(parsedRows, platform === 'youtube' ? 5 : 1, async row => {
    const parsed = parseAccountInput(platform, row.raw);
    if (parsed.ok) resolutions.set(row.index, await resolver.resolve(platform, parsed));
  });
  return transaction(async client => {
    // Serialises concurrent commits so two admins cannot both pass the duplicate check.
    await client.query('SELECT pg_advisory_xact_lock(710324)');
    const ctx = await loadContext(client, platform);
    const results = classifyBatch(parsedRows, { ...ctx, platform, resolutions });
    const personIdByRow = new Map<number, string>();
    const added: { personId: string; accountId: string }[] = [];
    for (const r of results) {
      if (!r.addable || !r.target || !r.externalId || !r.handle) continue;
      await client.query('SAVEPOINT row');
      try {
        let personId: string;
        if (r.target.kind === 'existing') personId = r.target.personId;
        else if (r.target.kind === 'batch') {
          const id = personIdByRow.get(r.target.index);
          if (!id) throw new Error('batch person missing');
          personId = id;
        } else {
          personId = (await client.query<{ id: string }>('INSERT INTO people(slug, display_name, created_by) VALUES($1,$2,$3) RETURNING id', [r.target.slug, r.target.displayName, actorId])).rows[0].id;
          personIdByRow.set(r.index, personId);
        }
        const acc = await client.query<{ id: string }>('INSERT INTO accounts(person_id, platform, external_id, handle) VALUES($1,$2,$3,$4) RETURNING id', [personId, platform, r.externalId, r.handle]);
        if (r.niche) await client.query(
          `INSERT INTO person_categories(person_id, category_id, is_primary)
           SELECT $1, c.id, NOT EXISTS (SELECT 1 FROM person_categories pc WHERE pc.person_id=$1 AND pc.is_primary)
           FROM categories c WHERE c.slug=$2 ON CONFLICT DO NOTHING`, [personId, r.niche]);
        await client.query('RELEASE SAVEPOINT row');
        added.push({ personId, accountId: acc.rows[0].id });
      } catch (e: any) {
        await client.query('ROLLBACK TO SAVEPOINT row');
        if (e?.code === '23505') { r.status = 'duplicate_in_bucket'; r.addable = false; }
        else { r.status = 'resolve_error'; r.addable = false; r.hint = 'Could not be saved'; }
      }
    }
    await client.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',
      [actorId, 'bucket.add', platform, JSON.stringify({ requested: results.length, added: added.length, newPeople: personIdByRow.size })]);
    return { rows: results as RowResult[], summary: summarizeBatch(results), added: added.length };
  });
}

export async function listBucket(opts: { platform?: Platform; q?: string; limit: number; offset: number }) {
  const where: string[] = []; const vals: unknown[] = [];
  if (opts.platform) { vals.push(opts.platform); where.push(`EXISTS (SELECT 1 FROM accounts a WHERE a.person_id=p.id AND a.platform=$${vals.length})`); }
  if (opts.q) { vals.push(`%${opts.q.replace(/[%_\\]/g, m => '\\' + m)}%`); where.push(`(p.display_name ILIKE $${vals.length} OR p.slug ILIKE $${vals.length})`); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (await query<{ n: string }>(`SELECT count(*)::text AS n FROM people p ${w}`, vals)).rows[0].n;
  vals.push(opts.limit, opts.offset);
  const rows = await query(`
    SELECT p.id, p.slug, p.display_name AS "displayName", p.created_at AS "createdAt",
      COALESCE((SELECT json_agg(json_build_object('id',a.id,'platform',a.platform,'handle',a.handle,'externalId',a.external_id) ORDER BY a.platform) FROM accounts a WHERE a.person_id=p.id),'[]') AS accounts,
      COALESCE((SELECT json_agg(json_build_object('slug',c.slug,'label',c.label,'primary',pc.is_primary) ORDER BY pc.is_primary DESC, c.slug) FROM person_categories pc JOIN categories c ON c.id=pc.category_id WHERE pc.person_id=p.id),'[]') AS categories
    FROM people p ${w} ORDER BY p.display_name, p.id LIMIT $${vals.length - 1} OFFSET $${vals.length}`, vals);
  return { total: Number(total), rows: rows.rows };
}

export async function setCategories(personId: string, slugs: string[], primary: string | null, actorId: string | null) {
  if (primary && !slugs.includes(primary)) throw new HttpError(400, 'PRIMARY_NOT_SELECTED', 'The primary category must be one of the selected categories');
  return transaction(async client => {
    if (!(await client.query('SELECT 1 FROM people WHERE id=$1 FOR UPDATE', [personId])).rowCount) throw new HttpError(404, 'NOT_FOUND', 'Person not found');
    const cats = await client.query<{ id: string; slug: string }>('SELECT id, slug FROM categories WHERE slug=ANY($1::text[]) AND active=true', [slugs]);
    if (cats.rowCount !== new Set(slugs).size) throw new HttpError(400, 'UNKNOWN_CATEGORY', 'One or more categories do not exist');
    await client.query('DELETE FROM person_categories WHERE person_id=$1', [personId]);
    for (const c of cats.rows) await client.query('INSERT INTO person_categories(person_id,category_id,is_primary) VALUES($1,$2,$3)', [personId, c.id, c.slug === primary]);
    await client.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)', [actorId, 'bucket.categories', personId, JSON.stringify({ count: cats.rowCount })]);
    return { categories: cats.rowCount };
  });
}

/** Hard delete. Registry rows go by cascade; linked legacy rows are removed in the same transaction. */
export async function deletePerson(personId: string, actorId: string | null) {
  return transaction(async client => {
    const person = await client.query('SELECT id FROM people WHERE id=$1 FOR UPDATE', [personId]);
    if (!person.rowCount) throw new HttpError(404, 'NOT_FOUND', 'Person not found');
    const acc = await client.query<{ legacy_creator_id: string | null; legacy_instagram_creator_id: string | null }>('SELECT legacy_creator_id, legacy_instagram_creator_id FROM accounts WHERE person_id=$1', [personId]);
    const yt = acc.rows.map(a => a.legacy_creator_id).filter((x): x is string => !!x);
    const ig = acc.rows.map(a => a.legacy_instagram_creator_id).filter((x): x is string => !!x);
    let legacy = 0;
    const has = async (t: string) => (await client.query('SELECT to_regclass($1) AS r', [t])).rows[0].r !== null;
    if (ig.length || yt.length) {
      if (await has('public.instagram_creators')) legacy += (await client.query('DELETE FROM instagram_creators WHERE id=ANY($1::uuid[]) OR youtube_creator_id=ANY($2::uuid[])', [ig, yt])).rowCount ?? 0;
      if (yt.length && await has('public.creators')) legacy += (await client.query('DELETE FROM creators WHERE id=ANY($1::uuid[])', [yt])).rowCount ?? 0;
    }
    // PCI_ZIP_3: remember every live ranking that contains this person, delete, then replace those rankings
    // (same transaction) with the same ranking minus this person. Nothing public can still show them.
    await client.query('SELECT pg_advisory_xact_lock(710325)'); // same lock as publishing: a publish and a delete never interleave
    const live = await captureLive(client);
    await client.query('DELETE FROM people WHERE id=$1', [personId]);
    const republished = await republishWithout(client, live, personId, actorId);
    await client.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)', [actorId, 'bucket.delete', personId, JSON.stringify({ accounts: acc.rowCount, legacyRows: legacy, republishedScopes: republished })]);
    return { deleted: true, accounts: acc.rowCount ?? 0, legacyRows: legacy, republishedScopes: republished };
  });
}
