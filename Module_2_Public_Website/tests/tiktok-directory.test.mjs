import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('TikTok directory and profile use real public endpoint and existing navigation',()=>{
 const s=read('src/components/TikTokDirectory.tsx');assert.match(s,/\/api\/v1\/public\/tiktok/);assert.match(s,/Not available/);assert.match(s,/15 days/);assert.doesNotMatch(s,/style=\{/);
 assert.match(read('src/app/creators/page.tsx'),/p.platform==='tiktok'/);assert.match(read('src/app/page.tsx'),/<TikTokDirectory compact\/>/);assert.match(read('src/app/creators/[slug]/page.tsx'),/<TikTokDirectory person=\{slug\}/);assert.match(read('src/app/creators/tiktok/[handle]/page.tsx'),/<TikTokDirectory handle=\{handle\}/);
});

test('TikTok listing reuses the shared list/grid template, not the separate cards',()=>{
 const route=read('src/app/creators/page.tsx');assert.match(route,/<CreatorsPage key="tiktok"/);assert.doesNotMatch(route,/<TikTokDirectory/);assert.match(route,/categoryLabel:/);assert.match(route,/views:null,posts30d:null/);
 const shared=read('src/fifi/pages/creators.tsx');assert.match(shared,/platform === "tiktok"/);assert.match(shared,/\/creators\/tiktok\/\$id/);assert.match(shared,/ViewToggle/);assert.match(shared,/ChipRow/);assert.match(shared,/!tiktok && open/);
});

test('TikTok listing maps safe avatars and profile totals into the shared layout',()=>{const route=read('src/app/creators/page.tsx');assert.match(route,/avatarUrl:safeCreatorImage\(x.avatarUrl\)/);assert.match(route,/tiktokMetrics:\{likes:x.likes/);const shared=read('src/fifi/pages/creators.tsx');assert.match(shared,/TikTokMetrics row=\{r\}/);assert.match(shared,/tiktok\?"Profile metrics":"Est. monthly earnings"/);});
