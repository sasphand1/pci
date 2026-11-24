import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const src=readFileSync(new URL('../src/modules/refresh/summary.ts',import.meta.url),'utf8');

// Exercise the actual read-only aggregation service with an isolated query adapter.
test('collection summary aggregates live database results without inventing totals', async()=>{
  let js=ts.transpileModule(src,{fileName:'summary.ts',compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  js=js.replace(/import\s*\{\s*query\s*\}\s*from\s*['"]\.\.\/\.\.\/lib\/db\.js['"];?/,'const query = globalThis.__pciSummaryQuery;');
  assert.ok(!js.includes("from '../../lib/db.js'"),'isolated DB adapter');
  const statements=[];
  const mockRows=[
    [{observations:1360,uniqueAccounts:115,days:4,firstDay:'2026-11-21',lastDay:'2026-11-24'}],
    [{platform:'youtube',metric:'followers',observations:360,uniqueAccounts:40,days:4,firstDay:'2026-11-21',lastDay:'2026-11-24'},
     {platform:'instagram',metric:'followers',observations:140,uniqueAccounts:75,days:1,firstDay:'2026-11-22',lastDay:'2026-11-22'}],
    [{day:'2026-11-24',platform:'youtube',observations:120},{day:'2026-11-24',platform:'instagram',observations:0}],
    [{platform:'instagram',trigger:'scheduled',status:'failed',startedAt:'2026-11-24T04:00:00Z',finishedAt:null,counts:{accounts:35,unsupported:35},failureReason:'graph_code_190'}],
    [{platform:'instagram',tracked:75,withPicture:12,missingPicture:63}]
  ];
  globalThis.__pciSummaryQuery=async sql=>{statements.push(sql);return {rows:mockRows[statements.length-1]};};
  try{
    const file=join(mkdtempSync(join(tmpdir(),'pci-collection-')),'summary.mjs');writeFileSync(file,js);
    const {getCollectionSummary}=await import(pathToFileURL(file).href);
    const result=await getCollectionSummary();
    assert.equal(result.totals.observations,1360);assert.equal(result.totals.uniqueAccounts,115);
    assert.equal(result.metrics.length,2);assert.equal(result.daily.length,2);
    assert.equal(result.latestRuns[0].failureReason,'graph_code_190');
    assert.equal(result.avatarCoverage[0].missingPicture,63);
    assert.equal(result.timezone,'Asia/Karachi');assert.equal(result.dailyWindowDays,14);
    assert.equal(statements.length,5);
    assert.ok(statements.every(x=>!/(UPDATE|DELETE|INSERT|TRUNCATE)\s/gi.test(x)),'read only');
    assert.ok(statements.some(x=>x.includes('COUNT(DISTINCT o.account_id)')));
    assert.ok(statements.some(x=>x.includes('avatar_url IS NULL')));
  }finally{delete globalThis.__pciSummaryQuery;}
});

test('summary endpoint is authenticated and precedes the UUID detail route',()=>{
  const src=readFileSync(new URL('../src/modules/refresh/routes.ts',import.meta.url),'utf8');
  assert.match(src,/refreshAdminRoutes\.use\('\/refresh', requireAdmin\)/);
  const summary=src.indexOf("get('/refresh/summary'");const detail=src.indexOf("get('/refresh/:id'");
  assert.ok(summary>0&&detail>summary,'static summary route must precede the parameter route');
  assert.match(src,/getCollectionSummary\(\)/);
});
