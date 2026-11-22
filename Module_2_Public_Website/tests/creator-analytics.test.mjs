import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');

test('published creator wheel displays model output, not lifetime views passed as earnings',()=>{
 const wheel=read('../src/components/PublishedWheel.tsx');
 const query=read('../../Module_1_Adapter/src/modules/public/queries.ts');
 assert.match(wheel,/c\.person\.estimatedMonthlyEarningsUsd/);
 assert.match(wheel,/Est\. monthly/);
 assert.match(wheel,/not verified income/i);
 assert.match(query,/monthlyEstimates\(\[\.\.\.ids\],now\)/);
 assert.doesNotMatch(wheel,/Math\.random/);
});
test('creator profile includes subscriber and viewer histories and honest earnings disclaimer',()=>{
 const page=read('../src/app/creators/[slug]/page.tsx');
 const panel=read('../src/components/CreatorAnalyticsPanel.tsx');
 assert.match(page,/CreatorAnalyticsPanel/);
 assert.match(panel,/30D|30d/);
 assert.match(panel,/data\.history\[metric\]/);
 assert.match(panel,/not verified revenue/i);
});

test('ranking wheel marks the actually contributing platforms with tiny top-right badges',()=>{
 const wheel=read('../src/components/PublishedWheel.tsx');
 const css=read('../src/app/public-stage.css');
 assert.match(wheel,/RankedPlatformBadges entry=\{c\} scope=\{current\.scope\}/);
 assert.match(wheel,/entry\.contributions\.map\(c=>c\.platform\)/);
 assert.match(css,/\.stage-platform-badges\{position:absolute;z-index:5;top:/);
 assert.match(wheel,/Collecting/);
 assert.match(wheel,/YT only/);
});

test('video observations are collected by the modern pipeline independently of ranking publication',()=>{
 const pipeline=read('../../Module_1_Adapter/src/modules/publish/pipeline.ts');
 const collector=read('../../Module_1_Adapter/src/modules/creator-analytics/videos.ts');
 const schema=read('../../Module_1_Adapter/database/migrations/102_creator_analytics.sql');
 assert.match(pipeline,/collectCreatorVideoSnapshots\(\)/);
 assert.match(pipeline,/await save\(true\)/);
 assert.match(collector,/creator_video_view_observations/);
 assert.match(collector,/pg_try_advisory_lock/);
 assert.match(schema,/CREATE TABLE IF NOT EXISTS creator_video_catalogue/);
 assert.match(schema,/CREATE TABLE IF NOT EXISTS creator_video_view_observations/);
});

test('creator profile exposes video-age milestones, velocity, breakout and honest missing-data states',()=>{
 const profile=read('../src/components/CreatorAnalyticsPanel.tsx');
 const api=read('../src/lib/public.ts');
 const compare=read('../src/app/compare/page.tsx');
 assert.match(profile,/Video performance/);
 assert.match(profile,/Views\/hour/);
 assert.match(profile,/breakoutFactor/);
 assert.match(profile,/30d figures cannot be reconstructed retroactively/);
 assert.match(api,/PubVideoAnalytics/);
 assert.match(compare,/Modeled monthly earnings \(USD\)/);
});
