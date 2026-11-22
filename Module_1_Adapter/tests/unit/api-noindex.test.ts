import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('every API response carries X-Robots-Tag noindex', () => {
  const s = readFileSync(new URL('../../src/server.ts', import.meta.url), 'utf8');
  assert.match(s, /setHeader\('X-Robots-Tag', 'noindex, nofollow'\)/);
  assert.ok(s.indexOf('X-Robots-Tag') > s.indexOf('helmet('), 'set right after helmet, before routes');
});
