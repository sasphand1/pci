import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('public restaurant images use shared data-driven viewport loading and plain missing label',()=>{
 const component=read('../src/fifi/components/restaurant-photo.tsx');
 assert.match(component,/IntersectionObserver/);assert.match(component,/encodeURIComponent\(p\.placeId\)/);assert.match(component,/Not Available/);
 assert.doesNotMatch(component,/Utensils|localStorage|sessionStorage|style=\{/);
 assert.match(component,/authorAttributions/);assert.match(component,/Google Maps/);
 for(const page of ['home','local'])assert.match(read('../src/fifi/pages/'+page+'.tsx'),/RestaurantPhoto/);
 const route=read('../src/app/api/local-google-photo/[placeId]/route.ts');assert.match(route,/no-store/);assert.match(route,/export async function POST/);
});
