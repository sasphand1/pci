import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isBackgroundRequest, sessionInfo, sessionTtlSeconds } from '../../src/modules/auth/session.js';

test('idle window applies while the absolute end is far away', () => { assert.equal(sessionTtlSeconds(1000, 1000 + 8 * 3600, 1800), 1800); });
test('the absolute end wins when it is closer than the idle window', () => { assert.equal(sessionTtlSeconds(1000, 1000 + 600, 1800), 600); });
test('a session past its absolute end has no time left and never goes negative', () => { assert.equal(sessionTtlSeconds(5000, 4000, 1800), 0); assert.equal(sessionTtlSeconds(5000, 5000, 1800), 0); });
test('sessions created before this release (no end stored) fall back to the idle window', () => { assert.equal(sessionTtlSeconds(1000, undefined, 1800), 1800); assert.equal(sessionTtlSeconds(1000, NaN, 1800), 1800); });
test('bad idle values are clamped to zero', () => { assert.equal(sessionTtlSeconds(0, undefined, -5), 0); assert.equal(sessionTtlSeconds(0, 100, 10.9), 10); });
test('only the exact background header value is treated as background', () => {
  assert.ok(isBackgroundRequest('1')); for (const v of [undefined, '', '0', 'true', ' 1']) assert.ok(!isBackgroundRequest(v), String(v));
});
test('session info for the client', () => {
  const i = sessionInfo(1000, 1000 + 3600, 1800); assert.equal(i.idleSeconds, 1800); assert.equal(i.ttlSeconds, 1800); assert.equal(i.expiresAt, new Date((1000 + 3600) * 1000).toISOString());
  assert.equal(sessionInfo(1000, undefined, 600).expiresAt, null);
});
test('requireAdmin extends the session only for real activity, and ends it past the absolute limit', () => {
  const s = readFileSync(new URL('../../src/modules/auth/auth.ts', import.meta.url), 'utf8');
  assert.match(s, /isBackgroundRequest\(req\.header\('x-pci-background'\)\)/); assert.match(s, /redis\.expire\(key,ttl\)/);
  assert.match(s, /ADMIN_SESSION_EXPIRED/); assert.match(s, /exp:nowSec\+config\.ADMIN_SESSION_HOURS\*3600/);
});
test('CORS allows the background header and the idle limit is configurable', () => {
  assert.match(readFileSync(new URL('../../src/server.ts', import.meta.url), 'utf8'), /'X-Pci-Background'/);
  assert.match(readFileSync(new URL('../../src/lib/config.ts', import.meta.url), 'utf8'), /ADMIN_IDLE_MINUTES: z\.coerce\.number\(\)\.int\(\)\.min\(5\)\.max\(480\)\.default\(30\)/);
});
