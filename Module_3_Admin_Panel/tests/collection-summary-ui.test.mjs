import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const ts=require('typescript');
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');

test('admin Overview mounts the live collection summary in its existing page',()=>{
  const page=read('../src/app/page.tsx');
  assert.match(page,/import \{CollectionSummary\} from '@\/components\/CollectionSummary'/);
  assert.match(page,/<CollectionSummary\/>/);
  assert.match(page,/useOverview\(\)/);
  assert.match(page,/Run pipeline now/);
});

test('collection summary uses session-aware API and renders exact rows, history, failures, and avatar counts',()=>{
  const component=read('../src/components/CollectionSummary.tsx');
  assert.match(component,/useData<Summary>\('\/admin\/refresh\/summary'\)/);
  for(const text of ['Metric observations','Metrics recorded','Unique accounts','Daily observations','Latest platform refreshes','Account picture coverage','missingPicture','failureReason'])
    assert.ok(component.includes(text),text);
  assert.match(component,/fmtNum\(data\.totals\.observations\)/);
  assert.ok(!component.includes('1,360'),'must not hardcode known snapshot');
});

test('both new TSX files parse with the installed TypeScript compiler',()=>{
  for(const f of ['../src/app/page.tsx','../src/components/CollectionSummary.tsx']){
    const fileName=new URL(f,import.meta.url).pathname;
    const out=ts.transpileModule(read(f),{fileName,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}});
    const errors=(out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
    assert.equal(errors.length,0,`${f}: ${errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')).join('; ')}`);
  }
});
