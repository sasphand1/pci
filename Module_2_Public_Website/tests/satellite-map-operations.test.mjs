import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('satellite map reuses existing Events map library and basemap without changing Events',()=>{
 const map=read('../public/satellite-map.html');
 assert.match(map,/maplibre-gl@5\.21\.0/);
 assert.match(map,/tiles\.openfreemap\.org\/styles\/dark/);
 assert.match(map,/PCI_SATELLITE_POINTS_V1/);
 assert.match(map,/new maplibregl.Map/);
});
test('satellite city loads go through same-origin proxy, not browser-facing API credentials',()=>{
 const dashboard=read('../src/components/SatelliteDashboard.tsx');
 assert.match(dashboard,/const API='\/api\/satellite'/);
 assert.doesNotMatch(dashboard,/NEXT_PUBLIC_ADAPTER_API_URL/);
 assert.match(dashboard,/fetch\(\x60\$\{API\}\?metric=/);
});
