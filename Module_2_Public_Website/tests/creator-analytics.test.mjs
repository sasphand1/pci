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
