import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const read=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');
const root=new URL('../src/app/',import.meta.url);
const header=read('../src/components/SiteHeader.tsx');
const layout=read('../src/app/layout.tsx');
const css=read('../src/app/public-header.css');
function pages(folder){const out=[];for(const item of readdirSync(folder,{withFileTypes:true})){if(item.isDirectory())out.push(...pages(join(folder,item.name)));else if(item.name==='page.tsx')out.push(join(folder,item.name));}return out;}
test('one public header template, included in the Next root layout',()=>{
 assert.match(layout,/import \{SiteHeader\} from ['"]@\/components\/SiteHeader['"]/);
 assert.match(layout,/<SiteHeader\s*\/>/);
 assert.match(layout,/import ['"]\.\/public-header\.css['"]/);
 assert.equal((layout.match(/<SiteHeader\s*\/>/g)||[]).length,1);
});
test('all public Next routes inherit header; no page duplicates it',()=>{
 const result=pages(fileURLToPath(root));
 assert.ok(result.length>9);
 for(const p of result){const content=readFileSync(p,'utf8');assert.doesNotMatch(content,/<SiteHeader\b|className=["']site-header["']/i,p);}
});
test('all five primary tabs are sourced once from the same SiteHeader',()=>{
 for(const label of ['Home','Events','Satellite','Insights','About'])assert.match(header,new RegExp(`label:'${label}'`));
 assert.doesNotMatch(header,/label:'(?:Rankings|Creators)'/);
 assert.match(header,/pathname\.startsWith\(`\$\{href\}\/`\)/);
 assert.match(header,/aria-current=\{active \? 'page' : undefined\}/);
});
test('public mobile navigation uses single menu with accessible state',()=>{
 assert.match(header,/data-open=\{open\}/);
 assert.match(header,/aria-expanded=\{open\}/);
 assert.match(css,/@media \(max-width: 1100px\)/);
 assert.match(css,/\.pci-primary-nav\[data-open="true"\]/);
});
test('Events embeds only an event map, not another website header',()=>{
 const event=read('../src/app/events/page.tsx');
 const radar=read('../public/events-radar.html');
 assert.match(event,/src="\/events-radar\.html"/);
 assert.match(radar,/data-pci-events-only="true"/);
 assert.doesNotMatch(radar,/<header\b/i);
 assert.match(radar,/id="category-tabs"/);
});
