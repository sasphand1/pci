import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');

test('published creator wheel displays model output, not lifetime views passed as earnings',()=>{
 const wheel=read('../src/components/PublishedWheel.tsx');
 const query=read('../../Module_1_Adapter/src/modules/public/queries.ts');
 assert.match(wheel,/entry\.person\.estimatedMonthlyEarningsUsd/);
 assert.match(wheel,/Est\. monthly/);
 assert.match(wheel,/not verified income/i);
 assert.match(query,/monthlyEstimates\(\[\.\.\.ids\],now\)/);
 assert.doesNotMatch(wheel,/Math\.random/);
});
test('ranking wheel marks the actually contributing platforms with tiny top-right badges',()=>{
 const wheel=read('../src/components/PublishedWheel.tsx');
 const css=read('../src/app/public-stage.css');
 assert.match(wheel,/RankedPlatformBadges entry=\{c\} scope=\{current\.scope\}/);
 assert.match(wheel,/entry\.contributions\.map\(c=>c\.platform\)/);
 assert.match(css,/\.stage-platform-badges\{position:absolute;z-index:5;top:/);
 assert.match(wheel,/earningsStatusLabel/);
 assert.match(wheel,/20\+ hours apart/);
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

test('earning-status labels distinguish missing, stale, and pending data',async()=>{
 const {earningsStatusLabel}=await import('../src/lib/earnings-status.mjs');
 assert.equal(earningsStatusLabel('needs_history'),'New tracking');
 assert.equal(earningsStatusLabel('no_view_data'),'No view data');
 assert.equal(earningsStatusLabel('stale'),'Data delayed');
 assert.equal(earningsStatusLabel('no_youtube'),'YT only');
 const api=read('../src/lib/public.ts');
 assert.match(api,/PubEarningsStatus/);
 const wheel=read('../src/components/PublishedWheel.tsx');
 assert.match(wheel,/entry\.person\.earningsStatus/);
 const backend=read('../../Module_1_Adapter/src/modules/creator-analytics/data.ts');
 assert.match(backend,/aggregateEarningsStatus/);
});

test('provisional earnings are explicitly distinguished from measured monthly growth',()=>{
 const back=read('../../Module_1_Adapter/src/modules/creator-analytics/data.ts');
 const front=read('../src/components/PublishedWheel.tsx');
 const scheduler=read('../../Module_1_Adapter/src/modules/sync/scheduler.ts');
 assert.match(back,/recentUploadFloors/);
 assert.match(back,/published_at >= \$2::timestamptz - interval '30 days'/);
 assert.match(back,/recent_uploads_floor/);
 assert.match(front,/entry\.person\.earningsBasis==='recent_uploads_floor'/);
 assert.match(front,/older uploads/);
 assert.match(scheduler,/collectCreatorVideoSnapshots\(\)/);
});

test('partial creator video sample coverage remains retryable without invented history',()=>{
 const data=read('../../Module_1_Adapter/src/modules/creator-analytics/data.ts');
 const scheduler=read('../../Module_1_Adapter/src/modules/sync/scheduler.ts');
 assert.match(data,/floors\.length/);
 assert.match(scheduler,/pendingAccounts/);
 assert.match(scheduler,/refreshCreatorVideoSamples/);
});

test('Instagram-only creators get a distinct sponsor scenario on the wheel and their profiles',()=>{
 const wheel=read('../src/components/PublishedWheel.tsx');
 const profile=read('../src/components/CreatorAnalyticsPanel.tsx');
 const backend=read('../../Module_1_Adapter/src/modules/creator-analytics/data.ts');
 const queries=read('../../Module_1_Adapter/src/modules/public/queries.ts');
 assert.match(backend,/instagramSponsorScenarios/);
 assert.match(backend,/metric='followers'/);
 assert.match(backend,/a\.platform='instagram'/);
 assert.match(queries,/instagramSponsorScenarioUsd=instagram\.get\(id\)/);
 assert.match(wheel,/IG sponsor\/mo/);
 assert.match(wheel,/instagramSponsorScenarioUsd/);
 assert.match(wheel,/contributions\.map\(c=>c\.platform\)/);
 assert.match(profile,/Instagram sponsor scenario \/ month/);
 assert.match(profile,/instagramAccountCount/);
 assert.match(wheel,/not a known deal/);
});
