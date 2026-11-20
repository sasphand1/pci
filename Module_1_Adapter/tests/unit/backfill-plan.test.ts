import test from 'node:test';
import assert from 'node:assert/strict';
import { planBackfill, type LegacyInstagram, type LegacyYoutube } from '../../src/modules/bucket/backfill-plan.js';

const yt = (id: string, name: string, cats: string[] = [], enabled = true): LegacyYoutube => ({ id, channelId: 'UC' + id.padEnd(22, 'x'), displayName: name, slug: name.toLowerCase().replace(/ /g, '-'), enabled, categoryIds: cats });
const ig = (id: string, user: string, over: Partial<LegacyInstagram> = {}): LegacyInstagram => ({ id, username: user, displayName: user, slug: user, enabled: true, eligibility: 'approved', youtubeCreatorId: null, instagramId: '100' + id, categoryIds: [], ...over });

test('linked Instagram joins its YouTube person; categories are unioned; primary only when exactly one', () => {
  const r = planBackfill([yt('a', 'Ducky Bhai', ['c1'])], [ig('i', 'ducky', { youtubeCreatorId: 'a', categoryIds: ['c1'] })]);
  assert.equal(r.people.length, 1); assert.equal(r.people[0].accounts.length, 2);
  assert.deepEqual(r.people[0].categoryIds, ['c1']); assert.equal(r.people[0].primaryCategoryId, 'c1');
  const two = planBackfill([yt('a', 'X Y', ['c1', 'c2'])], []);
  assert.equal(two.people[0].primaryCategoryId, null);
});
test('disabled and rejected rows are skipped and counted; pending is kept', () => {
  const r = planBackfill([yt('a', 'On'), yt('b', 'Off', [], false)], [ig('i', 'rej', { eligibility: 'rejected' }), ig('j', 'pend', { eligibility: 'pending' }), ig('k', 'off', { enabled: false })]);
  assert.equal(r.report.skippedDisabled, 2); assert.equal(r.report.skippedRejected, 1);
  assert.deepEqual(r.people.map(p => p.displayName).sort(), ['On', 'pend']);
});
test('Instagram without a stored provider id gets a pending placeholder and is reported', () => {
  const r = planBackfill([], [ig('i', 'u', { instagramId: null })]);
  assert.equal(r.people[0].accounts[0].externalId, 'pending:u'); assert.equal(r.report.instagramPendingId, 1);
});
test('two Instagram rows pointing at the same YouTube creator: the second stays its own person and is reported', () => {
  const r = planBackfill([yt('a', 'A B')], [ig('i', 'one', { youtubeCreatorId: 'a' }), ig('j', 'two', { youtubeCreatorId: 'a' })]);
  assert.equal(r.people.length, 2); assert.equal(r.report.duplicateLinkSplit, 1); assert.equal(r.warnings.length, 1);
});
test('duplicate provider accounts are dropped, never doubled', () => {
  const a = yt('a', 'Same'); const b = { ...yt('b', 'Same2'), channelId: a.channelId };
  const r = planBackfill([a, b], []);
  assert.equal(r.people.length, 1); assert.equal(r.report.duplicateAccounts, 1);
});
test('slugs are unique even against existing registry slugs, and the plan is deterministic', () => {
  const legacy = [yt('b', 'Same Name'), yt('a', 'Same Name')];
  const one = planBackfill(legacy, [], ['same-name']); const two = planBackfill([...legacy].reverse(), [], ['same-name']);
  assert.deepEqual(one.people.map(p => p.slug), two.people.map(p => p.slug));
  assert.equal(new Set(one.people.map(p => p.slug)).size, 2);
  assert.ok(!one.people.some(p => p.slug === 'same-name'));
});
test('every legacy account appears exactly once in the plan or is counted as skipped (completeness)', () => {
  const y = [yt('a', 'A A'), yt('b', 'B B', [], false)]; const i = [ig('i', 'u1', { youtubeCreatorId: 'a' }), ig('j', 'u2', { eligibility: 'rejected' }), ig('k', 'u3')];
  const r = planBackfill(y, i);
  const skipped = r.report.skippedDisabled + r.report.skippedRejected + r.report.duplicateAccounts;
  assert.equal(r.report.accounts + skipped, y.length + i.length);
});
