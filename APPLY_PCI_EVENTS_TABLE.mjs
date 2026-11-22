/** PCI Events Table overlay. No dependencies; install into existing PCI checkout. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const packageRoot=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(process.argv[2]||process.cwd());
const mod='Module_2_Public_Website';
const pagePath=`${mod}/src/app/events/page.tsx`;
const cssPath=`${mod}/packages/ui/src/styles.css`;
const required=[pagePath,cssPath,`${mod}/src/app/layout.tsx`];
for(const p of required){if(!fs.existsSync(path.join(repo,p)))throw new Error(`Missing expected PCI source: ${p}; no files changed`);}
const get=p=>fs.readFileSync(path.join(repo,p),'utf8');
let page=get(pagePath);
const importLine="import {EventsTable} from '@/components/EventsTable';";
if(!page.includes('<EventsTable />')){
  if(!page.includes("import type {Metadata} from 'next';")||!page.includes('className="pci-events-host"')||!page.includes('src="/events-radar.html"'))throw new Error('Existing Events page does not match the expected map component; no files changed');
  const open='  return (\n    <section className="pci-events-host"';
  const close='    </section>\n  );\n}';
  if(!page.includes(open)||!page.includes(close))throw new Error('Events page structure changed; no files changed');
  page=page.replace(open,'  return (\n    <>\n    <section className="pci-events-host"');
  page=page.replace(close,'    </section>\n    <EventsTable />\n    </>\n  );\n}');
}
if(!page.includes(importLine)){
  const old="import type {Metadata} from 'next';";
  if(!page.includes(old))throw new Error('Next.js Metadata import not found; no files changed');
  page=page.replace(old,old+'\n'+importLine);
}
if(!page.includes('<EventsTable />'))throw new Error('Events table insertion failed; no files changed');
let css=get(cssPath);
const importCss="@import './styles/events-table.css';";
if(!css.includes(importCss))css=css.trimEnd()+'\n'+importCss+'\n';
const expectedFiles=[
 `${mod}/src/components/EventsTable.tsx`,
 `${mod}/src/lib/event-table.mjs`,
 `${mod}/src/lib/event-table.d.mts`,
 `${mod}/packages/ui/src/styles/events-table.css`,
 `${mod}/tests/events-table.test.mjs`,
];
const operations=[{name:pagePath,content:page},{name:cssPath,content:css}];
for(const name of expectedFiles){
  const source=path.join(packageRoot,'payload',name);
  if(!fs.existsSync(source))throw new Error('Incomplete ZIP: missing '+name);
  const content=fs.readFileSync(source,'utf8');
  // Refuse to overwrite unrelated, locally customized files.
  if(fs.existsSync(path.join(repo,name))&&get(name)!==content)throw new Error(`Existing ${name} differs from the release. No files changed; inspect the conflict before updating.`);
  operations.push({name,content});
}
// All validation above happens before any file is modified.
let changed=0;
const backup=path.join(repo,'.pci-events-table-backup-20261122');
for(const item of operations){
  const destination=path.join(repo,item.name);
  if(fs.existsSync(destination)&&fs.readFileSync(destination,'utf8')===item.content)continue;
  if(fs.existsSync(destination)){
    const original=path.join(backup,item.name+'.bak');
    fs.mkdirSync(path.dirname(original),{recursive:true});
    if(!fs.existsSync(original))fs.copyFileSync(destination,original);
  }
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  fs.writeFileSync(destination,item.content,'utf8');
  console.log('UPDATED '+item.name);
  changed++;
}
console.log(`PCI Events table installed: ${changed} file(s) changed. The map and shared SiteHeader are preserved.`);
console.log('Run: node --test Module_2_Public_Website/tests/events-table.test.mjs');
console.log('Then: npm --prefix Module_2_Public_Website run typecheck && npm --prefix Module_2_Public_Website run build');
