/** Read-only inventory. AST-assisted, not a SQL parser or authorization boundary. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {SOURCE_POLICIES,finding} from '../src/architecture/contracts.ts';
const require=createRequire(import.meta.url);
const ts=require(process.env.PCI_AUDIT_TYPESCRIPT || 'typescript');
const repoDefault=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const skip=new Set(['node_modules','.git','.next','dist','coverage','vendor','packages']);
const modules=['Module_1_Adapter','Module_2_Public_Website','Module_3_Admin_Panel'];
const hub=new Set(['ingest_observations','ingest_latest','ingest_content']);
const staging=/^scrappa_(candidates|snapshots|pending_accounts|profile_checks)$/;
const legacy=new Set(['creators','videos','channel_stats_latest','video_stats_latest','metric_observations']);
const operations=/\b(insert\s+into|delete\s+from|update|truncate(?:\s+table)?|alter\s+table|create\s+(?:table|(?:or\s+replace\s+)?view)|drop\s+(?:table|view)|from|join|references)\s+(?:if\s+(?:not\s+)?exists\s+)?(?:only\s+)?((?:["\w]+\.)?["\w]+)\b/gi;
const clean=s=>s.replaceAll('"','').toLowerCase().replace(/^public\./,'');
const mode=s=>/^(from|join|references)$/i.test(s)?'read':/^(create|alter|drop)/i.test(s)?'ddl':'write';
const sqlLike=s=>/\b(select|insert\s+into|update|delete\s+from|create\s+(?:table|view)|alter\s+table|truncate)\b/i.test(s);
function walk(dir){return fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()&&!skip.has(e.name)?walk(path.join(dir,e.name)):e.isFile()?[path.join(dir,e.name)]:[]):[];}
function rel(root,f){return path.relative(root,f).split(path.sep).join('/');}
function stringValue(n){if(ts.isStringLiteralLike(n))return n.text;if(ts.isTemplateExpression(n))return n.head.text+n.templateSpans.map(s=>' ${?} '+s.literal.text).join('');return null;}
function nameOf(n){return ts.isIdentifier(n)?n.text:ts.isPropertyAccessExpression(n)?n.name.text:null;}
function inspectSQL(sql,file,line,origin,known){
 const result=[];if(!sqlLike(sql))return result;
 for(const m of sql.matchAll(operations)){
  const table=clean(m[2]);if(!known.has(table)&&mode(m[1])!=='ddl')continue;
  result.push({file,line:line+sql.slice(0,m.index).split('\n').length-1,operation:m[1].toLowerCase().replace(/\s+/g,' '),mode:mode(m[1]),table,origin});
 }
 return result;
}
export function scan(root=repoDefault){
 const files=modules.flatMap(m=>walk(path.join(root,m,'src'))).filter(f=>/\.(?:[cm]?[jt]sx?)$/.test(f)&&!f.endsWith('.d.ts')&&!f.endsWith('.d.mts')&&!f.endsWith('/architecture/contracts.ts'));
 const migrations=walk(path.join(root,modules[0],'database','migrations')).filter(f=>f.endsWith('.sql'));
 const known=new Set();
 for(const f of migrations){const s=fs.readFileSync(f,'utf8');for(const m of s.matchAll(operations))if(/^create\s/i.test(m[1]))known.add(clean(m[2]));}
 const accesses=[],dependencies=[],calls=[],unknown=[],sources=new Set(),findings=[];
 for(const f of migrations){const s=fs.readFileSync(f,'utf8');accesses.push(...inspectSQL(s,rel(root,f),1,'migration',known));for(const m of s.matchAll(/'([a-z][a-z0-9_]+\.(?:api|http|manual))'/g))sources.add(m[1]);}
 for(const f of files){
  const file=rel(root,f),src=fs.readFileSync(f,'utf8'),ast=ts.createSourceFile(f,src,ts.ScriptTarget.Latest,true);
  const line=n=>ast.getLineAndCharacterOfPosition(n.getStart(ast)).line+1;
  function visit(n){
   if(ts.isImportDeclaration(n)||ts.isExportDeclaration(n)){const s=n.moduleSpecifier;if(s&&ts.isStringLiteralLike(s))dependencies.push({file,line:line(n),target:s.text});}
   if(ts.isCallExpression(n)){
    const name=nameOf(n.expression),arg=n.arguments[0],value=arg?stringValue(arg):null;
    if(['query','execute','transaction','recordObservation','fetch','get','post','put','patch','delete','use','rankTikTok'].includes(name)){
     const receiver=ts.isPropertyAccessExpression(n.expression)?nameOf(n.expression.expression):null;
     if(['query','execute','transaction','recordObservation','fetch','rankTikTok'].includes(name)||value?.startsWith('/')||receiver?.toLowerCase().includes('route')){
      calls.push({file,line:line(n),name,receiver:receiver?.slice(0,120)??null,route:typeof value==='string'&&value.startsWith('/')?value:null});
     }
     if(['query','execute'].includes(name)&&(!value||value.includes('${?}')))unknown.push({file,line:line(n),kind:'dynamic_sql',...finding('PCI_ARCH_009')});
    }
   }
   const value=stringValue(n);
   if(value!==null){
    accesses.push(...inspectSQL(value,file,line(n),'source',known));
    if(/^[a-z][a-z0-9_]+\.(api|http|manual)$/.test(value))sources.add(value);
   }
   ts.forEachChild(n,visit);
  }visit(ast);
 }
 const unique=xs=>[...new Map(xs.map(x=>[JSON.stringify(x),x])).values()];
 const records=unique(accesses);
 for(const x of records){if(x.origin==='migration')continue;const isPublic=/\/src\/modules\/public\//.test(x.file);
  let code=null;
  if(isPublic&&staging.test(x.table))code='PCI_ARCH_004';
  else if(x.mode==='ddl')code='PCI_ARCH_007';
  else if(x.mode==='write'&&hub.has(x.table)&&!x.file.endsWith('/modules/ingest/store.ts'))code='PCI_ARCH_006';
  else if(legacy.has(x.table))code='PCI_ARCH_010';
  if(code)findings.push({...x,...finding(code)});
 }
 for(const x of calls)if(x.name==='rankTikTok'&&/\/modules\/public\//.test(x.file))findings.push({...x,...finding('PCI_ARCH_005')});
 for(const source of [...sources].sort())if(!Object.hasOwn(SOURCE_POLICIES,source))findings.push({source,...finding('PCI_ARCH_001')});
 const matrix=[...known].sort().map(table=>({table,readers:[...new Set(records.filter(x=>x.table===table&&x.mode==='read'&&x.origin==='source').map(x=>x.file))].sort(),writers:[...new Set(records.filter(x=>x.table===table&&x.mode==='write'&&x.origin==='source').map(x=>x.file))].sort(),ddl:[...new Set(records.filter(x=>x.table===table&&x.mode==='ddl').map(x=>x.file))].sort()}));
 return {version:1,mode:'observe-only',limitations:['AST literal heuristics, not SQL semantics; CTEs, aliases, generated SQL, indirect network calls and dynamic identifiers require review.','Table names inferred from migrations, not a live database.','Findings are review candidates, not proof of unauthorized access; approved bulk bridges and runtime schema checks are intentionally flagged.','No secrets or SQL payloads emitted. Routes/import paths are inventory only.'],summary:{sourceFiles:files.length,migrations:migrations.length,tables:known.size,sqlReferences:records.length,dependencies:dependencies.length,calls:calls.length,unresolved:unknown.length,findings:findings.length},sources:[...sources].sort(),matrix,findings:unique(findings),unresolved:unique(unknown),accesses:records,dependencies,calls};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const args=process.argv.slice(2);if(args.length>2||args.length===1||args.length===2&&args[0]!=='--out')throw Error('Usage: node scripts/architecture-audit.mjs [--out report.json]');
 const report=scan();if(args.length){fs.writeFileSync(path.resolve(args[1]),JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(report.summary));}else console.log(JSON.stringify(report,null,2));
}
