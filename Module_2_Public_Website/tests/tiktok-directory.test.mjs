import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('TikTok directory and profile use real public endpoint and existing navigation',()=>{
 const s=read('src/components/TikTokDirectory.tsx');assert.match(s,/\/api\/v1\/public\/tiktok/);assert.match(s,/Not available/);assert.match(s,/15 days/);assert.doesNotMatch(s,/style=\{/);
 assert.match(read('src/app/creators/page.tsx'),/p.platform==='tiktok'/);assert.match(read('src/app/page.tsx'),/<TikTokDirectory compact\/>/);assert.match(read('src/app/creators/[slug]/page.tsx'),/<TikTokDirectory person=\{slug\}/);assert.match(read('src/app/creators/tiktok/[handle]/page.tsx'),/<TikTokDirectory handle=\{handle\}/);
});
