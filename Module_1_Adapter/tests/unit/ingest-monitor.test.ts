import assert from 'node:assert/strict';
import {test} from 'node:test';
import {classifyHttpFailure,evaluateCoverage,evaluateQuota,evaluateSource,hubKey} from '../../src/modules/ingest/monitor-rules.ts';
const now=Date.parse('2026-11-23T12:00:00Z');
const base={id:'youtube.api',method:'api' as const,enabled:true,lastSuccessAt:'2026-11-23T08:00:00Z',consecutiveFailures:0,lastErrorCode:null,now,checkFreshness:true};
test('healthy source has no alerts',()=>{const r=evaluateSource(base);assert.equal(r.status,'ok');assert.equal(r.alerts.length,0);});
test('disabled source is never alerted',()=>{const r=evaluateSource({...base,enabled:false,lastSuccessAt:null,consecutiveFailures:9});assert.equal(r.status,'disabled');assert.equal(r.alerts.length,0);});
test('old data raises stale then no_data',()=>{
  const w=evaluateSource({...base,lastSuccessAt:'2026-11-21T20:00:00Z'});assert.equal(w.alerts[0].kind,'stale');assert.equal(w.status,'degraded');
  const c=evaluateSource({...base,lastSuccessAt:'2026-11-19T00:00:00Z'});assert.equal(c.alerts[0].kind,'no_data');assert.equal(c.alerts[0].severity,'critical');assert.equal(c.status,'down');
});
test('never-succeeded enabled source warns',()=>{const r=evaluateSource({...base,lastSuccessAt:null});assert.equal(r.alerts[0].kind,'no_data');assert.equal(r.alerts[0].severity,'warning');});
test('three failures map error code to alert kind',()=>{
  assert.equal(evaluateSource({...base,method:'http',checkFreshness:false,consecutiveFailures:3,lastErrorCode:'SHAPE_CHANGED'}).alerts[0].kind,'endpoint_changed');
  assert.equal(evaluateSource({...base,method:'http',checkFreshness:false,consecutiveFailures:3,lastErrorCode:'BLOCKED'}).alerts[0].kind,'blocked');
  assert.equal(evaluateSource({...base,method:'http',checkFreshness:false,consecutiveFailures:2,lastErrorCode:'BLOCKED'}).alerts.length,0);
});
test('http sources are not freshness-checked',()=>{assert.equal(evaluateSource({...base,method:'http',checkFreshness:false,lastSuccessAt:null}).alerts.length,0);});
test('quota thresholds',()=>{
  assert.equal(evaluateQuota(100,1000),null);
  assert.equal(evaluateQuota(800,1000)?.severity,'warning');
  assert.equal(evaluateQuota(950,1000)?.severity,'critical');
  assert.equal(evaluateQuota(1,0),null);
});
test('coverage thresholds',()=>{
  assert.equal(evaluateCoverage('youtube',100,95),null);
  assert.equal(evaluateCoverage('youtube',100,70)?.severity,'warning');
  assert.equal(evaluateCoverage('youtube',100,20)?.severity,'critical');
  assert.equal(evaluateCoverage('youtube',0,0),null);
});
test('http failure classification',()=>{
  assert.equal(classifyHttpFailure(null),'TIMEOUT');
  assert.equal(classifyHttpFailure(403),'BLOCKED');
  assert.equal(classifyHttpFailure(429),'BLOCKED');
  assert.equal(classifyHttpFailure(200,'<html>unusual traffic</html>'),'BLOCKED');
  assert.equal(classifyHttpFailure(200,'<html></html>'),'SHAPE_CHANGED');
  assert.equal(classifyHttpFailure(404),'SHAPE_CHANGED');
  assert.equal(classifyHttpFailure(500),'UNAVAILABLE');
});
test('alert keys are stable',()=>{assert.equal(hubKey('youtube.api','stale'),'hub:youtube.api:stale');});
import {evaluateInstagramAuth,evaluateInstagramLimit} from '../../src/modules/ingest/monitor-rules.ts';
test('Instagram token problem needs several attempts and a majority of 190s',()=>{
  assert.equal(evaluateInstagramAuth(2,2),null);
  assert.equal(evaluateInstagramAuth(10,2),null);
  assert.equal(evaluateInstagramAuth(10,0),null);
  const a=evaluateInstagramAuth(14,14);assert.equal(a?.kind,'token_invalid');assert.equal(a?.severity,'critical');
});
test('Instagram rate limit is a warning only',()=>{
  assert.equal(evaluateInstagramLimit(0),null);
  const a=evaluateInstagramLimit(3);assert.equal(a?.kind,'rate_limited');assert.equal(a?.severity,'warning');
});
