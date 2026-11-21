import test from 'node:test';
import assert from 'node:assert/strict';
import { compareRows } from '../../src/modules/public/shadow.js';
import { isLegacyPath, legacyEnabled, legacyGate } from '../../src/modules/public/legacy-gate.js';

const r = (...k: string[]) => k.map(x => ({ key: x, name: x.toUpperCase() }));
test('identical lists match completely', () => { const s = compareRows(r('a', 'b', 'c'), r('a', 'b', 'c'), 3); assert.equal(s.overlapPct, 100); assert.ok(s.sameOrder); });
test('reordering is reported with both positions', () => {
  const s = compareRows(r('a', 'b', 'c'), r('b', 'a', 'c'), 3);
  assert.equal(s.overlap, 3); assert.ok(!s.sameOrder); assert.deepEqual(s.moved.map(m => [m.key, m.legacy, m.published]), [['a', 1, 2], ['b', 2, 1]]);
});
test('people on one side only are named, and only the top N counts', () => {
  const s = compareRows(r('a', 'b', 'x'), r('a', 'c', 'x'), 2);
  assert.deepEqual(s.onlyLegacy.map(x => x.key), ['b']); assert.deepEqual(s.onlyNew.map(x => x.key), ['c']); assert.equal(s.overlapPct, 50);
});
test('two empty lists are not a mismatch', () => assert.equal(compareRows([], []).overlapPct, 100));
test('a shorter new list is not "same order"', () => assert.ok(!compareRows(r('a', 'b'), r('a'), 2).sameOrder));

test('old ranking and creator paths are recognised, new ones and shared ones are not', () => {
  for (const p of ['/creators', '/creators/some-slug', '/creators/x/videos', '/rankings', '/overview', '/unified/rankings', '/unified/overview', '/instagram/rankings', '/cross-platform/top', '/admin/instagram/creators', '/admin/cross-platform/preview', '/admin/unified/creators', '/creators/'])
    assert.ok(isLegacyPath(p), p);
  for (const p of ['/public/wheel', '/public/people', '/categories', '/site-config', '/status', '/meta', '/wall/messages', '/admin/bucket', '/admin/rank', '/admin/pipeline/status', '/admin/engine/status', '/admin/refresh', '/creatorship', '/rankings-x'])
    assert.ok(!isLegacyPath(p), p);
});
test('the gate answers 410 when retired and passes everything through when switched back on', () => {
  const calls: string[] = []; let status = 0, body: any;
  const res: any = { status: (n: number) => { status = n; return { json: (b: unknown) => { body = b; } }; } };
  legacyGate(() => false)({ path: '/rankings' }, res, () => calls.push('next'));
  assert.equal(status, 410); assert.equal(body.error.code, 'LEGACY_RETIRED'); assert.deepEqual(calls, []);
  status = 0; legacyGate(() => false)({ path: '/public/wheel' }, res, () => calls.push('next')); assert.deepEqual(calls, ['next']); assert.equal(status, 0);
  legacyGate(() => true)({ path: '/rankings' }, res, () => calls.push('next2')); assert.deepEqual(calls, ['next', 'next2']);
});
test('the old endpoints stay off unless explicitly enabled', () => { assert.equal(legacyEnabled({}), false); assert.equal(legacyEnabled({ PCI_LEGACY_PUBLIC: 'false' }), false); assert.equal(legacyEnabled({ PCI_LEGACY_PUBLIC: 'true' }), true); });
