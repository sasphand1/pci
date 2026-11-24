import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldPauseSource} from '../../src/modules/ingest/monitor-rules.js';
import {mapInstagram} from '../../src/providers/map.js';

const now = Date.parse('2026-11-24T18:00:00Z');
test('HTTP source pauses within six hours of its last failed attempt', () => {
  assert.equal(shouldPauseSource(3, new Date(now - 20 * 60_000), now), true);
  assert.equal(shouldPauseSource(3, new Date(now - 361 * 60_000), now), false);
  assert.equal(shouldPauseSource(2, new Date(now - 20 * 60_000), now), false);
  assert.equal(shouldPauseSource(3, null, now), false);
});
test('Meta authentication error is reported as an error, not an unsupported creator', () => {
  const r = mapInstagram({error:{code:190}},400,'rabeecakhan',now,50);
  assert.equal(r.outcome,'error');
  assert.equal(r.detail,'graph_code_190');
  assert.deepEqual(r.metrics,[]);
});
test('Meta 4 rate limiting and private-account errors remain unchanged', () => {
  assert.equal(mapInstagram({error:{code:4}},400,'rabeecakhan',now,50).outcome,'rate_limited');
  assert.equal(mapInstagram({error:{code:10}},400,'rabeecakhan',now,50).outcome,'unsupported');
});
