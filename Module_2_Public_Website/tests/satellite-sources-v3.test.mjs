import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('public dashboard fetches additional sources only through PCI same-origin proxy',()=>{
 const dash=read('../src/components/SatelliteDashboard.tsx');
 assert.match(dash,/const API='\/api\/satellite'/);
 for(const part of ['natural-events','gpm-imagery','scenes&mission=sentinel1','scenes&mission=sentinel2','scenes&mission=sentinel5p'])assert.ok(dash.includes(part));
 assert.doesNotMatch(dash,/NEXT_PUBLIC_ADAPTER_API_URL/);
});
test('proxy has fixed metrics and mission allowlists',()=>{const api=read('../src/app/api/satellite/route.ts');assert.match(api,/INVALID_FILTER/);assert.match(api,/missions=new Set/);assert.match(api,/ADAPTER_INTERNAL_URL/);assert.doesNotMatch(api,/req\.nextUrl\.searchParams\.get\('url'\)/);});
test('map reuses Events technology without embedding Events page',()=>{const map=read('../public/satellite-map.html');assert.match(map,/maplibre-gl@5\.21\.0/);assert.match(map,/tiles\.openfreemap\.org\/styles\/dark/);assert.match(map,/IMERG rain/);assert.match(map,/NASA imagery/);assert.match(map,/event\.origin!==location\.origin/);});
test('copernicus results do not masquerade as computed risk scores',()=>{const dash=read('../src/components/SatelliteDashboard.tsx');assert.match(dash,/not flood extent, NDVI crop health or pollutant concentration/);assert.match(dash,/not an emergency alert/);});
