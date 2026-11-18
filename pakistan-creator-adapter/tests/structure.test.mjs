import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
const cwd=resolve(import.meta.dirname,'..');
test('Docker and API source files are present',async()=>{
 for(const path of ['Dockerfile','compose.yaml','database/migrations/001_init.sql','src/server.ts','src/worker.ts','src/modules/ranking/rank.mjs','docs/openapi.yaml','docs/DEPLOYMENT.md']){
   await access(resolve(cwd,path));
 }
});
test('production secrets are not hardcoded in env template',async()=>{
 const env=await readFile(resolve(cwd,'.env.example'),'utf8');
 assert.match(env,/MFA_ENCRYPTION_KEY=CHANGE_ME_64_HEX/);
 assert.match(env,/LOG_HMAC_KEY=CHANGE_ME_64_HEX/);
 assert.match(env,/YOUTUBE_API_KEY=\s*\n/);
});
test('no approved advanced scoring algorithm is exposed as live API',async()=>{
 const src=await readFile(resolve(cwd,'src/modules/ranking/rank.mjs'),'utf8');
 assert.deepEqual([...src.matchAll(/'subscribers'|'views'|'videos'/g)].length>=3,true);
 assert.doesNotMatch(src,/fakeScore|influenceScore/);
});
