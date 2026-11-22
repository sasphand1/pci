import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');

test('production assets copy NASA satellite cooldown policy',()=>{
  const script=readFileSync(resolve(root,'scripts/copy-assets.mjs'),'utf8');
  const service=readFileSync(resolve(root,'src/modules/satellite/service.ts'),'utf8');
  assert.match(service,/from '\.\/policy\.mjs'/);
  assert.ok(existsSync(resolve(root,'src/modules/satellite/policy.mjs')));
  assert.match(script,/'modules\/satellite\/policy\.mjs'/);
});

test('production asset script checks all built JS and MJS imports',()=>{
  const script=readFileSync(resolve(root,'scripts/copy-assets.mjs'),'utf8');
  assert.match(script,/listCodeFiles\('dist'\)/);
  assert.match(script,/Unresolved production \.mjs imports/);
});
