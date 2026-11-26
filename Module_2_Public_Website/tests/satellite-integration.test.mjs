import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('satellite integrated into real Next.js app and navigation',()=>{assert.match(read('../src/app/satify/page.tsx'),/SatelliteDashboard/);assert.match(read('../src/components/SiteHeader.tsx'),/href:'\/satify'/);assert.match(read('../src/app/sitemap.ts'),/'satify'/);assert.match(read('../next.config.ts'),/source:'\/satellite',destination:'\/satify'/);});
test('satellite theme uses centralized ui stylesheet',()=>assert.match(read('../packages/ui/src/styles.css'),/satellite.css/));
test('satellite page identifies regional estimates',()=>assert.match(read('../src/components/SatelliteDashboard.tsx'),/NOT GPM/));
