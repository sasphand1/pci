import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseCompare,toggleSlug,creatorsHref,asOfLabel,leaderIndex,barPercent,accountFollowers,MAX_COMPARE} from '../src/lib/creators.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');

test('compare list: at most two, distinct, well formed, in order',()=>{
 assert.equal(MAX_COMPARE,2);
 assert.deepEqual(parseCompare('a-b, c-d,a-b,e-f,g-h,i-j'),['a-b','c-d']);
 assert.deepEqual(parseCompare("x';--,../y,ok-one"),['ok-one']);
 assert.deepEqual(parseCompare(undefined),[]);
 assert.deepEqual(toggleSlug(['a-b','c-d'],'i-j'),['a-b','c-d']);
 assert.deepEqual(toggleSlug(['a-b'],'a-b'),[]);
});
test('creators links keep filters, drop defaults and are shareable',()=>{
 assert.equal(creatorsHref(),'/creators');
 assert.equal(creatorsHref({platform:'instagram',sort:'followers',view:'grid',page:2}),'/creators?platform=instagram&sort=followers&view=grid&page=2');
 assert.equal(creatorsHref({compare:['a-b','c-d'],open:true}),'/creators?compare=a-b%2Cc-d&open=1');
 assert.equal(creatorsHref({compare:['a-b'],open:true}).includes('open'),true);
 assert.equal(creatorsHref({compare:[],open:true}).includes('open'),false);
});
test('last-known dates are labelled and a missing date gives no label',()=>{
 assert.equal(asOfLabel('2026-11-20T10:00:00Z'),'as of 20 Nov 2026');
 assert.equal(asOfLabel(null),'');
 assert.equal(asOfLabel('nonsense'),'');
});
test('compare maths: missing never wins and never becomes a bar of zero',()=>{
 assert.equal(leaderIndex([5,null,9]),2);
 assert.equal(leaderIndex([null,null]),-1);
 assert.equal(leaderIndex([9,9,3]),-1);
 assert.equal(barPercent(null,[1,2]),null);
 assert.equal(barPercent(50,[100,50,null]),50);
 assert.equal(barPercent(0,[100,0]),0);
 assert.equal(accountFollowers({accounts:[{platform:'youtube',followers:5},{platform:'youtube',followers:7},{platform:'instagram',followers:null}]},'youtube'),12);
 assert.equal(accountFollowers({accounts:[{platform:'instagram',followers:null}]},'instagram'),null);
});
test('the Creators page reads published data, has the compare tray and no inline styles',()=>{
 const page=read('../src/app/creators/page.tsx'),ui=read('../src/fifi/pages/creators.tsx'),panel=read('../src/fifi/pages/creators-compare.tsx'),kit=read("../src/fifi/components/explorer-kit.tsx");
 assert.match(page,/pubCreatorIndex/);
 assert.match(ui,/HeadToHeadCard/);assert.match(kit,/Head to head/);assert.match(ui,/MAX_COMPARE/);
 assert.match(panel,/VsDialog/);assert.match(kit,/role="dialog"/);assert.match(kit,/Escape/);
 for(const s of [ui,panel,kit])assert.doesNotMatch(s,/style=\{/);
 assert.doesNotMatch(ui,/12\.4M|editorial relevance/);
});
test('old compare links redirect to the Creators page',()=>{
 const old=read('../src/app/compare/page.tsx');
 assert.match(old,/redirect\(/);assert.match(old,/creatorsHref/);
});
