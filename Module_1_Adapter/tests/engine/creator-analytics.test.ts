import test from 'node:test';
import assert from 'node:assert/strict';
import {ASSUMED_RPM_USD, estimateMonthlyEarnings, earningsSampleStatus, aggregateEarningsStatus, gainAtPeriod, dailyHistory} from '../../src/modules/creator-analytics/engine.js';

const at=(days:number)=>new Date(Date.UTC(2026,10,22)-days*86_400_000).toISOString();
const now=new Date(at(0));

test('Social Blade RPM midpoint produces a single explicit USD estimate from monthly view gain',()=>{
  assert.equal(ASSUMED_RPM_USD,2.125);
  assert.deepEqual(estimateMonthlyEarnings([{at:at(30),value:10_000_000},{at:at(0),value:11_000_000}],now),{
    usd:2125, measuredDays:30, assumedRpmUsd:2.125, equivalent30DayViews:1_000_000
  });
});
test('seven-day tracked pace can be normalized without confusing lifetime and period views',()=>{
  const result=estimateMonthlyEarnings([{at:at(10),value:50_000_000},{at:at(0),value:50_100_000}],now);
  assert.equal(result?.equivalent30DayViews,300_000);
  assert.equal(result?.usd,638);
});
test('earnings fail closed for missing, stale, short, reset or future data',()=>{
  const cases=[
    [],[{at:at(0),value:10_000}],
    [{at:new Date(now.getTime()-2*3600000).toISOString(),value:500},{at:at(0),value:900}],
    [{at:at(12),value:900},{at:at(3),value:1000}],
    [{at:at(12),value:1100},{at:at(0),value:1000}],
    [{at:new Date(now.getTime()+3600000).toISOString(),value:200},{at:at(10),value:100}]
  ];
  for(const points of cases) assert.equal(estimateMonthlyEarnings(points,now),null);
});
test('history preserves real daily samples and gains only near requested periods',()=>{
  const points=[{at:at(30),value:500},{at:at(7),value:900},{at:at(0),value:1200}];
  assert.equal(gainAtPeriod(points,7,now),300);
  assert.equal(gainAtPeriod(points,30,now),700);
  assert.equal(gainAtPeriod(points,1,now),null);
  assert.equal(dailyHistory([{at:at(0),value:10},{at:at(0),value:20}]).length,1);
});

import {videoMilestones,velocityPerHour,breakoutFactor,subscriberMilestone} from '../../src/modules/creator-analytics/engine.js';

test('video age milestones only accept observed samples near the actual upload age',()=>{
  const published=at(31);
  const series=[{at:at(30),value:300},{at:at(24),value:2500},{at:at(1),value:6500}];
  const result=videoMilestones(series,published);
  assert.deepEqual(result,{'24h':300,'7d':2500,'30d':6500});
  assert.deepEqual(videoMilestones([{at:at(15),value:5000}],published),{'24h':null,'7d':null,'30d':null});
});

test('view velocity is a measured gain between samples and rejects resets',()=>{
  assert.equal(velocityPerHour([{at:at(1),value:100},{at:at(0),value:340}]),10);
  assert.equal(velocityPerHour([{at:at(1),value:340},{at:at(0),value:100}]),null);
  assert.equal(velocityPerHour([{at:at(0),value:100}]),null);
});

test('breakout needs at least three older comparable videos',()=>{
  assert.equal(breakoutFactor(300,[100,100,100]),3);
  assert.equal(breakoutFactor(300,[100,100]),null);
  assert.equal(breakoutFactor(null,[100,100,100]),null);
});

test('subscriber milestone projection requires observed positive 30-day growth',()=>{
  assert.deepEqual(subscriberMilestone(8500,3000),{target:10000,estimatedDays:15});
  assert.deepEqual(subscriberMilestone(8500,null),{target:10000,estimatedDays:null});
  assert.equal(subscriberMilestone(null,20),null);
});

test('a measured 24-hour channel view gain produces a labeled projected monthly figure',()=>{
  const points=[{at:at(1),value:10_000_000},{at:at(0),value:10_010_000}];
  assert.equal(earningsSampleStatus(points,now),'ready');
  assert.equal(estimateMonthlyEarnings(points,now)?.equivalent30DayViews,300_000);
});
test('no samples, not-yet-24h, and stale samples have distinct states',()=>{
  assert.equal(earningsSampleStatus([],now),'no_view_data');
  assert.equal(earningsSampleStatus([{at:at(0),value:10}],now),'needs_history');
  assert.equal(earningsSampleStatus([{at:at(5),value:100}],now),'stale');
  assert.equal(aggregateEarningsStatus([]),'no_youtube');
  assert.equal(aggregateEarningsStatus(['ready','needs_history']),'needs_history');
  assert.equal(aggregateEarningsStatus(['ready','stale']),'stale');
});
