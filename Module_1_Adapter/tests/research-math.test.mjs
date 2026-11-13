import test from 'node:test';
import assert from 'node:assert/strict';
import {bayesianMean,wilsonLowerBound} from '../src/modules/ranking/research.mjs';
test('IMDb-style Bayesian shrinkage uses sample-size uncertainty',()=>{
 assert.ok(Math.abs(bayesianMean({observedMean:100000,sampleSize:2,priorMean:20000,priorStrength:10})-33333.3333)<.01);
 assert.ok(Math.abs(bayesianMean({observedMean:60000,sampleSize:20,priorMean:20000,priorStrength:10})-46666.6667)<.01);
});
test('larger samples move estimate toward observed mean',()=>{
 const f=n=>bayesianMean({observedMean:90,sampleSize:n,priorMean:50,priorStrength:10});
 assert.ok(f(50)>f(5));
});
test('Wilson lower bound is in range and penalizes tiny samples',()=>{
 const tiny=wilsonLowerBound({positive:1,total:1});const large=wilsonLowerBound({positive:100,total:100});
 assert.ok(tiny<large && large<1 && tiny>0);
 assert.equal(wilsonLowerBound({positive:0,total:0}),0);
});
test('refuses impossible/NaN inputs',()=>{
 assert.throws(()=>wilsonLowerBound({positive:11,total:10}));
 assert.throws(()=>bayesianMean({observedMean:NaN,sampleSize:2,priorMean:10,priorStrength:10}));
});
