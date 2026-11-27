import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read=p=>readFileSync(p,'utf8');

test('legacy mock admin is removed and design images are compressed',()=>{
 assert.equal(existsSync('src/app/admin/page.tsx'),false);
 assert.equal(existsSync('src/fifi/pages/admin.tsx'),false);
 assert.match(read('next.config.ts'),/admin/);
 for(const f of ['fifi-boy','fifi-companion','pakistan-skyline'])assert.ok(existsSync(`public/images/fifi/${f}.webp`),f);
});
