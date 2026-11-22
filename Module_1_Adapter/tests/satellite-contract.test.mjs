import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('production copy step includes runtime catalog',()=>assert.match(read('../scripts/copy-assets.mjs'),/modules\/satellite\/catalog\.mjs/));
test('satellite API is mounted under existing PCI routes',()=>{const x=read('../src/server.ts');assert.match(x,/app\.use\('\/api\/v1\/satellite',satellitePublicRoutes\)/);assert.match(x,/app\.use\('\/api\/v1\/admin\/satellite',satelliteAdminRoutes\)/);});
test('management routes require authenticated owner and audit changes',()=>{const x=read('../src/modules/satellite/routes.ts');assert.match(x,/satelliteAdminRoutes\.use\(requireAdmin,roles\('owner'\)\)/);assert.match(x,/satellite\.provider\.update/);assert.match(x,/satellite\.provider\.refresh_requested/);});
test('refresh uses background worker and scheduled dispatch',()=>{assert.match(read('../src/modules/sync/scheduler.ts'),/satelliteTick/);assert.match(read('../src/modules/satellite/service.ts'),/refresh_requested_at/);});
test('satellite DB uses idempotent migration with per-hotspot uniqueness',()=>{const x=read('../database/migrations/096_satellite.sql');assert.match(x,/CREATE SCHEMA IF NOT EXISTS satellite/);assert.match(x,/unique\(provider,metric,location,observed_at,observation_key\)/);});
