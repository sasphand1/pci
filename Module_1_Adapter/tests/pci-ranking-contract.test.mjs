import test from 'node:test';
import assert from 'node:assert/strict';
import {rankPeople,rankAllRounders} from '../src/modules/unified/metrics.mjs';
const person=(id,status,subscribers,views,ig)=>({id,slug:'person-'+id,displayName:'Person '+id,enabled:true,humanReviewStatus:status,categories:[{slug:'vloggers-influencers',label:'Vloggers & Influencers'}],youtube:{url:'https://youtube.com/channel/'+id,subscribers,views,videos:'10'},instagram:ig==null?null:{url:'https://instagram.com/'+id,followers:ig,posts:'5'}});
test('new and removed accounts always re-rank from current eligible cohort',()=>{
 const a=person('a','approved','100','100',null),b=person('b','approved','200','200',null),c=person('c','approved','300','300',null);
 assert.deepEqual(rankPeople([a,b,c],{metric:'subscribers'}).data.map(x=>x.id),['c','b','a']);
 assert.deepEqual(rankPeople([a,c],{metric:'subscribers'}).data.map(x=>x.rank),[1,2]);
});
test('pending, disabled and missing metrics never get public ranks',()=>{
 const a=person('a','approved','100','100',null),b=person('b','pending','200','200',null),c=person('c','approved',null,'250',null),d={...person('d','approved','500','500',null),enabled:false};
 assert.deepEqual(rankPeople([a,b,c,d],{metric:'subscribers'}).data.map(x=>x.id),['a']);
});
test('all rounder requires both sources, approval and complete metrics',()=>{
 const a=person('a','approved','100','100','100'),b=person('b','approved','200','200','200'),c=person('c','approved','1000','1000',null),d=person('d','pending','500','500','500');
 const result=rankAllRounders([a,b,c,d]);
 assert.deepEqual(result.data.map(x=>x.id),['b','a']);
 assert.equal(result.data[0].allRounderScore,100);
 assert.equal(result.data[1].allRounderScore,0);
});
