import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('owner only satellite nav',()=>assert.match(read('../src/lib/nav.ts'),/Satellite APIs'.*roles:\['owner'\]/));
test('admin uses csrf validated api client',()=>{const page=read('../src/app/satellite/page.tsx');assert.match(page,/csrf/);assert.match(page,/RoleGate roles=\{\['owner'\]\}/);assert.doesNotMatch(page,/API_KEY=/);});
