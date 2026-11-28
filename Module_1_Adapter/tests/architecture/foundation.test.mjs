import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectObservation,observeArchitecture,SOURCE_POLICIES} from '../../src/architecture/contracts.ts';
import {scan} from '../../scripts/architecture-audit.mjs';
const valid={sourceId:'youtube.api',entityKind:'account',entityId:'youtube:abc',accountId:'registry-id',metric:'followers'};
const candidate={sourceId:'scrappa.api',entityKind:'account',entityId:'tiktok_candidate:123',accountId:null,metric:'followers',metadata:{stage:'candidate'}};
const codes=v=>inspectObservation(v).map(x=>x.code);
test('known creator observation',()=>assert.deepEqual(codes(valid),[]));
test('unknown source fails policy, including prototype names',()=>{for(const sourceId of ['new.api','toString','__proto__'])assert.deepEqual(codes({...valid,sourceId}),['PCI_ARCH_001']);});
test('wrong entity kind is reported',()=>assert.ok(codes({...valid,entityKind:'place'}).includes('PCI_ARCH_002')));
test('missing account or wrong platform key is reported',()=>{assert.deepEqual(codes({...valid,accountId:null}),['PCI_ARCH_003']);assert.deepEqual(codes({...valid,entityId:'instagram:abc'}),['PCI_ARCH_003']);});
test('Scrappa candidate staging is allowed in shadow, not certified for publication',()=>{assert.deepEqual(codes(candidate),[]);assert.deepEqual(codes({...candidate,metadata:{}}),['PCI_ARCH_003']);});
test('Scrappa unknown metric is reported',()=>assert.deepEqual(codes({...candidate,metric:'unknown_field'}),['PCI_ARCH_008']));
test('noncreator observations need no account',()=>assert.deepEqual(codes({sourceId:'google_places.api',entityKind:'place',entityId:'place:1',accountId:null,metric:'rating'}),[]));
test('all 23 production source identifiers are represented',()=>assert.equal(Object.keys(SOURCE_POLICIES).length,23));
test('shadow is opt-in, emits corrective code without payload and rate limits',()=>{
 const old=process.env.PCI_ARCH_SHADOW,warn=console.warn,logs=[];console.warn=(x)=>logs.push(x);
 try{delete process.env.PCI_ARCH_SHADOW;observeArchitecture({...valid,sourceId:'private-value.api'});assert.equal(logs.length,0);process.env.PCI_ARCH_SHADOW='1';observeArchitecture({...valid,sourceId:'private-value.api'});observeArchitecture({...valid,sourceId:'private-value.api'});assert.equal(logs.length,1);assert.match(logs[0],/PCI_ARCH_001/);assert.doesNotMatch(logs[0],/private-value|registry-id/);}finally{console.warn=warn;if(old===undefined)delete process.env.PCI_ARCH_SHADOW;else process.env.PCI_ARCH_SHADOW=old;}
});
test('scanner locates staging bypass, rank bypass, DDL, direct Hub writes and dynamic SQL',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pci-aef-fixture-'));
 const put=(name,body)=>{const f=path.join(root,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,body);};
 try{
  put('Module_1_Adapter/database/migrations/001.sql','CREATE TABLE IF NOT EXISTS scrappa_snapshots (id int); CREATE TABLE ingest_latest (id int); CREATE TABLE accounts (id int);');
  put('Module_1_Adapter/src/modules/public/tiktok.ts',"import {query} from '../../lib/db.js'; query('SELECT * FROM scrappa_snapshots'); rankTikTok([]); query(dynamicSql);");
  put('Module_1_Adapter/src/modules/satellite/hub.ts',"query('INSERT INTO ingest_latest(id) VALUES(1)'); query('ALTER TABLE accounts ADD x int');");
  const r=scan(root);for(const code of ['PCI_ARCH_004','PCI_ARCH_005','PCI_ARCH_006','PCI_ARCH_007'])assert.ok(r.findings.some(f=>f.code===code),code);
  assert.ok(r.unresolved.some(f=>f.code==='PCI_ARCH_009'));assert.ok(r.matrix.find(x=>x.table==='scrappa_snapshots').readers.length===1);assert.equal(r.mode,'observe-only');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
