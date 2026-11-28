import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('TikTok candidate admin reads snapshots and guards owner mutations',()=>{
 const s=read('src/app/bucket/ScrappaPeople.tsx');for(const path of ['/link','/collect','/remove','/snapshots'])assert.ok(s.includes(path));
 assert.match(s,/window.confirm/);assert.match(s,/using up to 4 credits/);assert.match(s,/csrf/);assert.doesNotMatch(s,/style=\{/);
});
test('Data Hub shows private TikTok coverage and distinguishes third-party source',()=>{
 const s=read('src/app/hub/page.tsx');assert.match(s,/TikTok Creators Bucket \(private staging\)/);assert.match(s,/Third-party API/);assert.match(s,/scheduledLimit/);assert.match(s,/refresh-settings/);
});
test('owner can approve or revoke TikTok publication explicitly',()=>{const s=read('src/app/bucket/ScrappaPeople.tsx');assert.match(s,/Publish to PCI/);assert.match(s,/Unpublish/);assert.match(s,/permission to republish/);assert.match(s,/publish:!r.published_at,confirm:true/);});

test('credential manager shows titled keys with masked secrets and guarded actions',()=>{const s=read('src/app/bucket/ScrappaPeople.tsx');for(const v of ['scrappa-key-grid','Saved API keys','Key title','/rename','/delete','disabled={busy||k.active}','confirm:true','••••••••'])assert.ok(s.includes(v),v);assert.doesNotMatch(s,/k\.ciphertext|k\.apiKey/);const p=read('src/app/bucket/page.tsx');assert.equal((p.match(/className="scrappa-platform-mark"/g)||[]).length,3);});

test('per-key allowance, separate result lists and credit monitor are wired',()=>{const s=read('src/app/bucket/ScrappaPeople.tsx');for(const v of ['k.used','k.remaining','/cap','prepareRegistration','Check format (free)','batchResult.success','batchResult.failed','batchResult.skipped','Add to bucket (free)'])assert.ok(s.includes(v),v);const hub=read('src/app/hub/page.tsx');for(const v of ['Credential balances','Recent request ledger','Recent collection runs','Creator refresh state','lastRequestAt'])assert.ok(hub.includes(v),v);});

test('bulk registration normalizes profile URLs, validates format, and deduplicates before paid calls',async()=>{
 const {createRequire}=await import('node:module');const ts=createRequire(import.meta.url)('typescript');
 const source=ts.transpileModule(read('src/lib/scrappa-input.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const {prepareRegistration}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const result=prepareRegistration([{account:'@Alpha',person:'First'},{account:'https://www.tiktok.com/@alpha?lang=en',person:'Second'},{account:'beta'},{account:'https://evil.example/@beta'},{account:'@bad user'},{account:''}]);
 assert.deepEqual(result.valid,[{account:'alpha',person:'First'},{account:'beta'}]);assert.deepEqual(result.duplicates,['alpha']);assert.deepEqual(result.invalid,['https://evil.example/@beta','@bad user','(empty account)']);
});

test('registration uses free local checks and pending endpoint, not paid verification',()=>{const s=read('src/app/bucket/ScrappaPeople.tsx');const submit=s.split('async function submit(')[1].split('const capValid')[0];assert.match(submit,/batch.length>200/);assert.match(submit,/\('\/pending',valid\.slice\(i,i\+25\)\)/);assert.doesNotMatch(submit,/['"]\/check['"]|window.confirm/);assert.match(s,/Collect profile \(1 credit\)/);});
