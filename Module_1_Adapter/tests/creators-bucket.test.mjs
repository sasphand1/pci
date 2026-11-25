import test from 'node:test';
import assert from 'node:assert/strict';
import {count,series,daily,gain,average,engagement,likeRate,periodRates,DAY} from '../src/modules/creators-bucket/logic.mjs';
const t=Date.parse('2026-11-25T09:00:00Z');
const at=(d,h=0)=>new Date(t+d*DAY+h*3600000).toISOString();
const p=(d,value,h=0)=>({at:at(d,h),value});
test('null, invalid, unsafe, rounded-looking strings never become zero; genuine zero remains',()=>{for(const v of [null,undefined,'',' ','-1','2.5',false,true,'1e6',-1,2.5,NaN,Infinity,'9007199254740992'])assert.equal(count(v),null);assert.equal(count('0'),0);assert.equal(count('22100000'),22100000);});
test('history sorted, deduplicated, future excluded; original observations retained',()=>{assert.deepEqual(series([p(-1,10),p(-3,1),p(-1,11),p(1,99),p(-2,null)],t),[p(-3,1),p(-1,11)]);});
test('daily chart selects latest actual sample within UTC day, no fabricated dates',()=>{assert.deepEqual(daily([p(-3,5),p(-3,6,1),p(0,9)],t),[p(-3,6,1),p(0,9)]);});
test('gain requires real nearby baseline and fresh end; zero is valid',()=>{assert.equal(gain([p(-7,10),p(0,25)],7,t),15);assert.equal(gain([p(-7,25),p(0,25)],7,t),0);assert.equal(gain([p(-6,10),p(-3,25)],7,t),null);assert.equal(gain([p(-3,10),p(0,25)],7,t),null);});
test('view counter decreases rejected, subscriber decline retained',()=>{assert.equal(gain([p(-7,30),p(0,20)],7,t),null);assert.equal(gain([p(-7,30),p(0,20)],7,t,true),-10);});
test('average distinguishes unavailable from real zero',()=>{assert.equal(average([null,null]),null);assert.equal(average([null,0,20]),10);});
test('engagement excludes incomplete fields and zero-view denominators',()=>{assert.equal(engagement(1000,20,5),2.5);assert.equal(engagement(1000,0,0),0);assert.equal(engagement(1000,20,null),null);assert.equal(engagement(0,20,5),null);assert.equal(likeRate(1000,20),2);assert.equal(likeRate(1000,null),null);});
test('rolling view growth uses actual baseline timestamps and suppresses decreases',()=>{assert.deepEqual(periodRates([p(-14,100),p(-7,200),p(0,150)],7,t),[{at:at(-7),from:at(-14),value:100}]);assert.deepEqual(periodRates([p(-30,10),p(0,90)],30,t),[{at:at(0),from:at(-30),value:80}]);assert.deepEqual(periodRates([p(-20,10),p(0,90)],30,t),[]);});

test('a counter reset inside an interval cannot be masked by later recovery',()=>{assert.equal(gain([p(-7,100),p(-4,90),p(0,150)],7,t),null);assert.deepEqual(periodRates([p(-7,100),p(-4,90),p(0,150)],7,t),[]);});
