/** Prevent growth of detected architecture bypasses relative to the pinned Batch 1 commit.
 * Existing violations are debt, NOT approved routes. No claim of SQL authorization. */
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {scan} from './architecture-audit.mjs';
export const BASE='445f5d1456a3d616aed03255b5ffeb2f4691b542';
const blocking=new Set(['PCI_ARCH_001','PCI_ARCH_004','PCI_ARCH_005','PCI_ARCH_006','PCI_ARCH_007']);
const fingerprint=f=>JSON.stringify([f.code,f.file??'',f.table??'',f.operation??'',f.name??'',f.source??'']);
function counts(report){const m=new Map();for(const f of report.findings){if(!blocking.has(f.code))continue;const k=fingerprint(f);const row=m.get(k)??{count:0,f};row.count++;m.set(k,row);}return m;}
export function compareReports(base,current){const before=counts(base);return [...counts(current)].flatMap(([key,row])=>{const delta=row.count-(before.get(key)?.count??0);return delta>0?[{...row.f,additional:delta}]:[];});}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const git=(...args)=>execFileSync('git',['-C',root,...args],{stdio:'inherit'});
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pci-architecture-gate-'));const checkout=path.join(temp,'baseline');let added=false;
 try{
  git('merge-base','--is-ancestor',BASE,'HEAD');
  git('worktree','add','--detach',checkout,BASE);added=true;
  const before=scan(checkout),current=scan(root),violations=compareReports(before,current);
  console.log(JSON.stringify({baseline:BASE,baselineFindings:before.summary.findings,currentFindings:current.summary.findings,newViolations:violations},null,2));
  if(violations.length)process.exitCode=1;
 }finally{if(added)git('worktree','remove',checkout);fs.rmSync(temp,{recursive:true,force:true});}
}
