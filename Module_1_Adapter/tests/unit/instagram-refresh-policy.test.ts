import test from 'node:test';
import assert from 'node:assert/strict';
import { INSTAGRAM_PER_RUN, isInstagramLimit, shouldHoldInstagramRun } from '../../src/modules/refresh/instagram-policy.js';

const now = Date.parse('2026-11-22T12:00:00Z');
test('Instagram has a bounded per-run budget', () => assert.equal(INSTAGRAM_PER_RUN, 35));
test('rate-limited outcomes stop subsequent requests', () => {
  assert.equal(isInstagramLimit({outcome:'rate_limited',detail:'graph_code_4'}), true);
  assert.equal(isInstagramLimit({outcome:'ok'}), false);
});
test('manual bursts are blocked for one hour', () => {
  assert.equal(shouldHoldInstagramRun({last_run: new Date(now-15*60_000),last_limited:null},now),true);
  assert.equal(shouldHoldInstagramRun({last_run: new Date(now-61*60_000),last_limited:null},now),false);
});
test('Meta code 4 holds refreshes for six hours even after restart', () => {
  assert.equal(shouldHoldInstagramRun({last_run:null,last_limited:new Date(now-5*3600_000)},now),true);
  assert.equal(shouldHoldInstagramRun({last_run:null,last_limited:new Date(now-7*3600_000)},now),false);
});
test('fresh installations are not blocked', () => {
  assert.equal(shouldHoldInstagramRun({last_run:null,last_limited:null},now),false);
});
