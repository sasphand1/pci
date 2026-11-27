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
