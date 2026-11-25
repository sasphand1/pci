import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('public dashboard fetches additional sources only through PCI same-origin proxy',()=>{
 const dash=read('../src/components/SatelliteDashboard.tsx');
 assert.match(dash,/const API='\/api\/satellite'/);
 for(const part of ['natural-events','gpm-imagery','alerts','rivers','space-weather','imagery-layers',"'air-quality'","'weather'"])assert.ok(dash.includes(part),part);
 assert.doesNotMatch(dash,/mission=sentinel|science-scenes/);
 assert.doesNotMatch(dash,/NEXT_PUBLIC_ADAPTER_API_URL/);
});
test('proxy has fixed metric allowlists and no catalogue-only scene routes',()=>{const api=read('../src/app/api/satellite/route.ts');assert.match(api,/INVALID_FILTER/);assert.match(api,/const regional:Record<string,string>=/);assert.doesNotMatch(api,/scenes|missions/);assert.match(api,/Object\.hasOwn\(perCity,metric\)&&cities\.has\(city\)/);assert.match(api,/ADAPTER_INTERNAL_URL/);assert.doesNotMatch(api,/req\.nextUrl\.searchParams\.get\('url'\)/);});
test('map reuses Events technology without embedding Events page',()=>{const map=read('../public/satellite-map.html');assert.match(map,/maplibre-gl@5\.21\.0/);assert.match(map,/tiles\.openfreemap\.org\/styles\/dark/);assert.match(map,/IMERG rain/);assert.match(map,/NASA imagery/);assert.match(map,/event\.origin!==location\.origin/);});
test('modelled readings do not masquerade as official warnings or station data',()=>{const dash=read('../src/components/SatelliteDashboard.tsx');assert.match(dash,/Modelled \(CAMS\), not a station reading/);assert.match(dash,/Not an official FFD forecast/);assert.match(dash,/not an emergency alert/);});
test('map accepts only approved NASA GIBS extra layers',()=>{const map=read('../public/satellite-map.html');assert.match(map,/const EXTRA_RE=/);assert.match(map,/VIIRS_SNPP_DayNightBand_ENCC\|MODIS_Combined_Value_Added_AOD\|MODIS_Terra_NDSI_Snow_Cover/);assert.match(map,/layer-toggle/);for(const c of ['farm:','safety:','solar:','city:'])assert.ok(map.includes(c),c);});
