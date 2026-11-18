import test from 'node:test';
import assert from 'node:assert/strict';
import {rankCrossPlatform} from '../src/modules/cross-platform/score.mjs';
const make=(id,s,v,f)=>({youtubeCreatorId:id,instagramCreatorId:id,curated:true,eligibility:'approved',enabled:true,subscriberCount:String(s),viewCount:String(v),followersCount:String(f)});
test('rank one and two by normalized within-cohort order',()=>{
 const xs=rankCrossPlatform([make('a',30,30,30),make('b',20,20,20),make('c',10,10,10)]);
 assert.deepEqual(xs.map(x=>[x.youtubeCreatorId,x.rank,x.score]),[['a',1,100],['b',2,50],['c',3,0]]);
});
test('identical dimensions produce exact tied rank including split crown metadata',()=>{
 const xs=rankCrossPlatform([make('a',20,20,20),make('b',20,20,20),make('c',10,10,10)]);
 assert.equal(xs[0].rank,1);assert.equal(xs[1].rank,1);assert.equal(xs[0].tiedWith,2);assert.equal(xs[1].tiedWith,2);
});
test('unapproved, uncurated, disabled and missing data are excluded',()=>{
 const rows=[make('a',10,10,10),{...make('b',100,100,100),curated:false},{...make('c',100,100,100),eligibility:'pending'},{...make('d',100,100,100),enabled:false},{...make('e',100,100,100),followersCount:null}];
 assert.deepEqual(rankCrossPlatform(rows).map(x=>x.youtubeCreatorId),['a']);
});
test('counts beyond Number safe integer remain correctly ordered',()=>{
 const xs=rankCrossPlatform([make('a','9007199254740993',10,10),make('b','9007199254740992',10,10)]);
 assert.equal(xs[0].youtubeCreatorId,'a');
});
test('single-person cohort and invalid limit',()=>{
 assert.equal(rankCrossPlatform([make('a',1,1,1)])[0].score,100);
 assert.throws(()=>rankCrossPlatform([],{limit:0}));
});
