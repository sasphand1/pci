import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('admin is noindex and the design images are compressed',()=>{
 assert.match(read('src/app/admin/page.tsx'),/index:\s*false/);
 assert.match(read('next.config.ts'),/admin/);
 for(const f of ['fifi-boy','fifi-companion','pakistan-skyline'])assert.ok(existsSync(`public/images/fifi/${f}.webp`),f);
});
