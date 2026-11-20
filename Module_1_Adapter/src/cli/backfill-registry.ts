// One-time import of the legacy creator tables into the registry (people/accounts).
// Default is a DRY RUN that prints a report. Pass --apply to write. Safe to re-run:
// anything already in the registry is skipped. Never modifies the legacy tables.
import { pool, transaction } from '../lib/db.js';
import { ensureRegistrySchema } from '../lib/registry-schema.js';
import { planBackfill, type LegacyInstagram, type LegacyYoutube } from '../modules/bucket/backfill-plan.js';

async function main() {
  const apply = process.argv.includes('--apply');
  await ensureRegistrySchema();
  const yt = await pool.query(`SELECT c.id, c.channel_id AS "channelId", c.display_name AS "displayName", c.slug, c.enabled,
      COALESCE(array_agg(cc.category_id) FILTER (WHERE cc.category_id IS NOT NULL), '{}') AS "categoryIds"
    FROM creators c LEFT JOIN creator_categories cc ON cc.creator_id=c.id GROUP BY c.id`);
  const ig = await pool.query(`SELECT i.id, i.username, i.display_name AS "displayName", i.slug, i.enabled, i.eligibility,
      i.youtube_creator_id AS "youtubeCreatorId", s.instagram_id AS "instagramId",
      COALESCE(array_agg(ic.category_id) FILTER (WHERE ic.category_id IS NOT NULL), '{}') AS "categoryIds"
    FROM instagram_creators i LEFT JOIN instagram_creator_categories ic ON ic.creator_id=i.id
    LEFT JOIN instagram_stats_latest s ON s.creator_id=i.id GROUP BY i.id, s.instagram_id`);
  const have = await pool.query('SELECT platform, external_id FROM accounts');
  const haveKeys = new Set(have.rows.map(r => `${r.platform}:${r.external_id}`));
  const slugs = (await pool.query('SELECT slug FROM people')).rows.map(r => r.slug as string);

  const plan = planBackfill(yt.rows as LegacyYoutube[], ig.rows as LegacyInstagram[], slugs);
  const fresh = plan.people.filter(p => !p.accounts.some(a => haveKeys.has(`${a.platform}:${a.externalId}`)));
  console.log(JSON.stringify({ mode: apply ? 'APPLY' : 'DRY RUN', ...plan.report, alreadyImported: plan.people.length - fresh.length, toImport: fresh.length }, null, 2));
  for (const w of plan.warnings) console.log('warning:', w);
  if (!apply) { console.log('Nothing written. Re-run with --apply to import.'); return; }

  await transaction(async c => {
    await c.query('SELECT pg_advisory_xact_lock(710324)');
    for (const p of fresh) {
      const id = (await c.query('INSERT INTO people(slug, display_name) VALUES($1,$2) RETURNING id', [p.slug, p.displayName])).rows[0].id;
      for (const a of p.accounts) await c.query('INSERT INTO accounts(person_id,platform,external_id,handle,legacy_creator_id,legacy_instagram_creator_id) VALUES($1,$2,$3,$4,$5,$6)', [id, a.platform, a.externalId, a.handle, a.legacyCreatorId, a.legacyInstagramCreatorId]);
      for (const cid of p.categoryIds) await c.query('INSERT INTO person_categories(person_id,category_id,is_primary) VALUES($1,$2,$3)', [id, cid, cid === p.primaryCategoryId]);
    }
    await c.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES(NULL,$1,NULL,$2::jsonb)', ['bucket.backfill', JSON.stringify({ people: fresh.length })]);
  });
  console.log(`Imported ${fresh.length} people.`);
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
