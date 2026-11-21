// Real PostgreSQL *_test database. The public API reads only what was published.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pool, query } from '../../src/lib/db.js';
import { ensureRegistrySchema } from '../../src/lib/registry-schema.js';
import { ensureObservationsSchema } from '../../src/lib/observations-schema.js';
import { ensurePublicationSchema } from '../../src/lib/publication-schema.js';
import { ensurePublicSchema } from '../../src/lib/public-schema.js';
import { buildBatch, publishBatch } from '../../src/modules/publish/service.js';
import { deletePerson } from '../../src/modules/bucket/service.js';
import { categoryList, directory, personDetail, pointers, rankings } from '../../src/modules/public/queries.js';
import { publicRankingRoutes } from '../../src/modules/public/routes.js';
import { ENDPOINTS } from '../../src/modules/public/endpoints.js';

if (process.env.NODE_ENV !== 'test' || !/\/[^/]*_test(?:\?|$)/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('Refusing writable integration tests: set NODE_ENV=test and use a separate *_test PostgreSQL database');
}
async function clean() { for (const t of ['pipeline_alerts', 'pipeline_runs', 'published_pointers', 'rank_runs', 'refresh_runs']) await query(`TRUNCATE ${t} CASCADE`); await query('TRUNCATE people CASCADE'); }
test.before(async () => {
  await ensureRegistrySchema(); await ensureObservationsSchema(); await ensurePublicationSchema(); await ensurePublicSchema(); await clean();
  await query(`INSERT INTO categories(slug,label) VALUES('gamer','Gamer'),('cook','Cook') ON CONFLICT (slug) DO NOTHING`);
});
test.beforeEach(clean);
test.after(async () => { await clean(); await pool.end(); });

const UC = (n: number) => 'UC' + String(n).padStart(22, '0');
let seq = 0;
async function person(followers: number, o: { category?: string; instagram?: number; avatar?: string; name?: string } = {}) {
  const k = ++seq;
  const id = (await query('INSERT INTO people(slug,display_name) VALUES($1,$2) RETURNING id', [`pub-${k}`, o.name ?? `Person ${k}`])).rows[0].id;
  const yt = (await query(`INSERT INTO accounts(person_id,platform,external_id,handle,avatar_url) VALUES($1,'youtube',$2,$3,$4) RETURNING id`, [id, UC(k), `h${k}`, o.avatar ?? null])).rows[0].id;
  await obs(yt, followers, followers * 10, 4);
  if (o.instagram !== undefined) { const ig = (await query(`INSERT INTO accounts(person_id,platform,external_id,handle) VALUES($1,'instagram',$2,$3) RETURNING id`, [id, `ig${k}`, `insta.${k}`])).rows[0].id; await obs(ig, o.instagram, 0, 2, false); }
  if (o.category) await query(`INSERT INTO person_categories(person_id,category_id,is_primary) SELECT $1,id,true FROM categories WHERE slug=$2`, [id, o.category]);
  return { id, slug: `pub-${k}`, yt };
}
async function obs(account: string, followers: number, views: number, posts: number, withViews = true, ageHours = 1) {
  const rows: [string, number][] = [['followers', followers], ['posts_30d', posts]]; if (withViews) rows.push(['views', views]);
  for (const [m, v] of rows) await query(`INSERT INTO metric_observations(account_id,metric,value,observed_at) VALUES($1,$2,$3, now() - make_interval(hours => $4))`, [account, m, v, ageHours]);
}
const publish = async () => { const b = await buildBatch('manual', null); await publishBatch(b.batchId, null); return b; };

test('every documented endpoint is registered', () => {
  const paths = (publicRankingRoutes as any).stack.map((l: any) => l.route?.path).filter(Boolean);
  assert.deepEqual(paths.sort(), ENDPOINTS.map(e => e.path).sort());
});

test('drafts are invisible; after publishing the wheel shows people with picture links, ties and contributions', async () => {
  const a = await person(5000, { category: 'gamer', instagram: 2000, avatar: 'https://yt3.ggpht.com/a=s240' });
  await person(5000, { category: 'gamer' }); await person(100, { category: 'cook', avatar: 'https://evil.example/x.png' });
  await buildBatch('manual', null);
  assert.deepEqual(await pointers(), []);
  assert.ok((await rankings(['wheel.subscribed'], 12))[0].publishedAt === null && (await rankings(['wheel.subscribed'], 12))[0].entries.length === 0);
  await publish();
  const [w] = await rankings(['wheel.subscribed'], 12);
  assert.equal(w.entries.length, 3); assert.equal(w.entries[0].person.slug, a.slug); assert.equal(w.entries[0].value, 7000);
  assert.deepEqual(w.entries[0].contributions.map(c => c.platform).sort(), ['instagram', 'youtube']);
  assert.equal(w.entries[0].person.avatarUrl, 'https://yt3.ggpht.com/a=s240');
  assert.equal(w.entries[2].person.avatarUrl, null, 'a picture link on an unknown host is never shown');
  assert.equal(w.stale, false); assert.equal(w.covered, 3);
  const [y] = await rankings(['youtube.subscribed'], 12); assert.equal(y.entries[0].rank, 1); assert.ok(y.entries[0].tied && y.entries[1].tied && !y.entries[2].tied); assert.equal(y.entries[1].rank, 1);
  const urls = w.entries[0].person.accounts.map(x => x.url);
  assert.ok(urls.includes(`https://www.youtube.com/channel/${UC(seq - 2)}`)); assert.ok(urls.includes(`https://www.instagram.com/insta.${seq - 2}/`));
});

test('the limit applies, categories get their own row, and a category with no published ranking is not listed as having one', async () => {
  for (let i = 0; i < 20; i++) await person(1000 + i, { category: 'gamer' });
  await person(50, { category: 'cook' });
  await publish();
  const [top5] = await rankings(['wheel.subscribed'], 5); assert.equal(top5.entries.length, 5); assert.equal(top5.covered, 21);
  const cats = await categoryList(); assert.equal(cats.find(c => c.slug === 'gamer')!.people, 20); assert.ok(cats.find(c => c.slug === 'gamer')!.hasRanking);
  const [g] = await rankings(['category.gamer'], 15); assert.equal(g.label, 'Gamer'); assert.equal(g.entries.length, 15);
});

test('directory: best published position first, search is literal, category filter works, paging reports totals', async () => {
  await person(10, { name: 'Zed 50%' }); await person(900, { name: 'Amir', category: 'gamer' }); await person(500, { name: 'Bina', category: 'gamer' });
  await publish();
  const all = await directory({ page: 1, limit: 25 });
  assert.deepEqual(all.data.map(p => p.displayName), ['Amir', 'Bina', 'Zed 50%']); assert.equal(all.total, 3);
  assert.deepEqual((await directory({ page: 1, limit: 25, pattern: '%50\\%%' })).data.map(p => p.displayName), ['Zed 50%']);
  assert.equal((await directory({ page: 1, limit: 25, pattern: '%\\%\\%%' })).total, 0, 'a % in the search is not a wildcard');
  assert.equal((await directory({ page: 1, limit: 25, category: 'gamer' })).total, 2);
  const p2 = await directory({ page: 2, limit: 2 }); assert.deepEqual(p2.data.map(p => p.displayName), ['Zed 50%']);
});

test('person page: fresh numbers only, published positions, unknown slug is null', async () => {
  const p = await person(800, { instagram: 300 });
  await query(`INSERT INTO metric_observations(account_id,metric,value,observed_at) SELECT id,'followers',999999, now() - interval '30 days' FROM accounts WHERE person_id=$1 AND platform='instagram'`, [p.id]);
  await publish();
  const d = (await personDetail(p.slug))!;
  const yt = d.accounts.find((a: any) => a.platform === 'youtube')!, ig = d.accounts.find((a: any) => a.platform === 'instagram')!;
  assert.equal(yt.followers, 800); assert.equal(yt.views, 8000); assert.equal(ig.followers, 300, 'the latest fresh value wins over an old one'); assert.equal(ig.views, null);
  assert.ok(d.positions.some((x: any) => x.scope === 'wheel.subscribed' && x.slot === 1 && x.value === 1100));
  assert.equal(await personDetail('no-such-person'), null);
});

test('a stale observation is never shown as a number', async () => {
  const p = await person(100);
  await query(`UPDATE metric_observations SET observed_at = now() - interval '9 days' WHERE account_id=$1`, [p.yt]);
  const d = (await personDetail(p.slug))!; assert.equal(d.accounts[0].followers, null); assert.equal(d.accounts[0].views, null);
});

test('hard delete leaves no trace in anything the public can read', async () => {
  const keep = await person(900, { category: 'gamer' }); const gone = await person(950, { category: 'gamer', instagram: 100 }); await person(400, { category: 'gamer' });
  await publish();
  await deletePerson(gone.id, null);
  for (const scope of ['wheel.subscribed', 'wheel.viewed', 'wheel.active', 'youtube.subscribed', 'instagram.followers', 'category.gamer']) {
    const [r] = await rankings([scope], 100);
    assert.ok(!r.entries.some(e => e.person.slug === gone.slug), scope);
    r.entries.forEach((e, i) => assert.equal(e.slot, i + 1, `${scope} slots stay gap-free`));
  }
  const [w] = await rankings(['wheel.subscribed'], 12); assert.equal(w.entries[0].person.slug, keep.slug); assert.equal(w.entries[0].value, 900, 'the others keep their numbers');
  assert.equal(await personDetail(gone.slug), null);
  assert.equal((await directory({ page: 1, limit: 25 })).total, 2);
  assert.equal((await query('SELECT count(*)::int AS n FROM accounts WHERE person_id=$1', [gone.id])).rows[0].n, 0);
});
