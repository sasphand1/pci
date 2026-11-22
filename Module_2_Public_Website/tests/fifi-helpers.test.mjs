import test from 'node:test';
import assert from 'node:assert/strict';
import {growthPercent,formatPercent,formatCompact,initials,toCreatorCards,buildHomeStats,topMovers,freshness,isActivePath,safeSlug,safePage,safeSearchParam,NAV,BRAND} from '../src/lib/fifi.mjs';

test('growthPercent computes from the gain and refuses impossible bases',()=>{
 assert.equal(growthPercent(110,10),10);
 assert.equal(growthPercent(100,100),null);
 assert.equal(growthPercent(100,150),null);
 assert.equal(growthPercent(null,5),null);
 assert.equal(growthPercent(100,null),null);
 assert.equal(growthPercent(NaN,1),null);
});
test('formatPercent never turns missing into zero',()=>{
 assert.equal(formatPercent(null),'Not available');
 assert.equal(formatPercent(undefined),'Not available');
 assert.equal(formatPercent(0),'0.0%');
 assert.equal(formatPercent(12.4),'+12%');
 assert.equal(formatPercent(1.26),'+1.3%');
 assert.equal(formatPercent(-2.5),'-2.5%');
});
test('formatCompact',()=>{
 assert.equal(formatCompact(null),'Not available');
 assert.equal(formatCompact('abc'),'Not available');
 assert.equal(formatCompact(0),'0');
 assert.equal(formatCompact(999),'999');
 assert.equal(formatCompact(1500),'1.5K');
 assert.equal(formatCompact(12400000),'12.4M');
 assert.equal(formatCompact(1000000),'1M');
 assert.equal(formatCompact(2500000000),'2.5B');
});
test('initials',()=>{assert.equal(initials('Ducky Bhai'),'DB');assert.equal(initials('  '),'?');assert.equal(initials('Zed'),'Z');assert.equal(initials(null),'?');});
test('toCreatorCards keeps published order, ties and missing values',()=>{
 const ranking={unit:'subscribers',entries:[
  {rank:1,tied:false,value:10,person:{slug:'a-one',displayName:'A One',avatarUrl:null,categories:[{slug:'x',label:'Tech'}],accounts:[{platform:'youtube'},{platform:'youtube'},{platform:'instagram'}]}},
  {rank:2,tied:true,value:null,person:{slug:'b-two',displayName:'B Two',avatarUrl:'u',categories:[],accounts:[]}},
  {rank:2,tied:true,value:5,person:null},
 ]};
 const cards=toCreatorCards(ranking,5);
 assert.equal(cards.length,2);
 assert.deepEqual(cards[0].platforms,['youtube','instagram']);
 assert.equal(cards[0].category,'Tech');
 assert.equal(cards[1].value,null);assert.equal(cards[1].category,null);assert.equal(cards[1].tied,true);
 assert.equal(toCreatorCards(ranking,1).length,1);
 assert.deepEqual(toCreatorCards(null),[]);
 assert.deepEqual(toCreatorCards({entries:'x'}),[]);
});
test('buildHomeStats reports unknown as null, not zero',()=>{
 const s=buildHomeStats({status:{people:42},rows:{platforms:[{scope:'youtube.subscribed',population:30}]},eventsUpcoming:undefined});
 const by=Object.fromEntries(s.map(x=>[x.key,x.value]));
 assert.equal(by.people,42);assert.equal(by.youtube,30);assert.equal(by.instagram,null);assert.equal(by.events,null);
 assert.equal(buildHomeStats({status:null,rows:null,eventsUpcoming:0}).find(x=>x.key==='events').value,0);
});
test('topMovers ranks by percentage and skips unknowns and non-growth',()=>{
 const mk=(slug,subs,gain)=>({slug,name:slug,subscribers:subs,analytics:{growth:{subscribers:{'7d':gain,'24h':null,'30d':null}}}});
 const out=topMovers([mk('a',1100,100),mk('b',210,10),mk('c',500,null),mk('d',500,-5),{slug:'e',name:'e',subscribers:5,analytics:null},mk('f',150,50)],'7d',3);
 assert.deepEqual(out.map(x=>x.slug),['f','a','b']);
 assert.equal(topMovers([mk('a',1100,100)],'30d').length,0);
});
test('freshness',()=>{
 const now=Date.parse('2026-11-22T12:00:00Z');
 assert.equal(freshness(null,now).state,'unknown');
 assert.equal(freshness('nope',now).state,'unknown');
 assert.equal(freshness('2026-11-22T00:00:00Z',now).state,'fresh');
 assert.equal(freshness('2026-11-20T00:00:00Z',now).state,'stale');
});
test('nav and active state',()=>{
 assert.ok(NAV.every(n=>n.href.startsWith('/')));
 assert.ok(!NAV.some(n=>/admin/.test(n.href)));
 assert.deepEqual(NAV.map(n=>n.label),['Home','Creators','Dramas','Events','Local','Satellite','Insights','About']);
 assert.equal(isActivePath('/','/'),true);assert.equal(isActivePath('/creators/x','/'),false);
 assert.equal(isActivePath('/creators/x','/creators'),true);assert.equal(isActivePath('/creatorsx','/creators'),false);
 assert.ok(BRAND.wordmark&&BRAND.product);
});
test('input guards',()=>{
 assert.equal(safeSlug('ok-slug'),'ok-slug');assert.equal(safeSlug('Bad/Slug'),'');assert.equal(safeSlug(5),'');
 assert.equal(safePage('3'),3);assert.equal(safePage('-1'),1);assert.equal(safePage(undefined),1);assert.equal(safePage('99999999'),10000);
 assert.equal(safeSearchParam('a'.repeat(300)).length,100);assert.equal(safeSearchParam(['x']),'');assert.equal(safeSearchParam('a\u0000b'),'ab');
});
