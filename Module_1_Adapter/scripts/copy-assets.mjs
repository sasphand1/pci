import { mkdirSync as pciMkdirSync, copyFileSync as pciCopyFileSync } from 'node:fs';

// PCI_INSTAGRAM_DIAGNOSTICS_ASSET_FIX
pciMkdirSync(
  new URL('../dist/modules/bucket/', import.meta.url),
  { recursive: true }
);

pciCopyFileSync(
  new URL('../src/modules/bucket/instagram-error.mjs', import.meta.url),
  new URL('../dist/modules/bucket/instagram-error.mjs', import.meta.url)
);
import { cp, mkdir, access, readFile, readdir } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';

// Native .mjs dependencies are not emitted by TypeScript (tsconfig includes .ts only).
// Every production runtime asset imported by compiled files must be copied explicitly.
const runtimeModules=[
  'modules/creators-bucket/logic.mjs',
  'modules/creators-bucket/cohort.mjs',
  'modules/events/classifier.mjs',
  'modules/youtube/normalizers.mjs',
  'modules/ranking/rank.mjs',
  'modules/ranking/research.mjs',
  'modules/instagram/ranking.mjs',
  'modules/cross-platform/score.mjs',
  'modules/unified/metrics.mjs',
  'modules/engine/status.mjs',
  'modules/satellite/catalog.mjs',
  'modules/satellite/open-data.mjs',
  'modules/satellite/insights.mjs',
  'modules/satellite/guard.mjs',
  'modules/satellite/bulk.mjs',
  'modules/satellite/feeds.mjs',
  'modules/satellite/policy.mjs',
  'modules/local/rules.mjs',
  'modules/local/image-rules.mjs',
];

for(const modulePath of runtimeModules){
  const source=`src/${modulePath}`,target=`dist/${modulePath}`;
  await access(source);
  await mkdir(dirname(target),{recursive:true});
  await cp(source,target);
  await access(target);
  console.info(`Copied runtime module: ${modulePath}`);
}

// Fail deployment preparation if any local .mjs import is unresolved.
// Scan generated JS and copied MJS: this catches future missing assets before Hostinger starts.
async function listCodeFiles(dir){
  const files=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const file=`${dir}/${entry.name}`;
    if(entry.isDirectory())files.push(...await listCodeFiles(file));
    else if(entry.isFile()&&['.js','.mjs'].includes(extname(entry.name)))files.push(file);
  }
  return files;
}
const missing=[];
for(const file of await listCodeFiles('dist')){
  const code=await readFile(file,'utf8');
  const imports=/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"](\.[^'"]+\.mjs)['"]/g;
  for(const match of code.matchAll(imports)){
    const dependency=resolve(dirname(file),match[1]);
    try{await access(dependency);}catch{missing.push(`${file}: ${match[1]}`);}
  }
}
if(missing.length)throw new Error(`Unresolved production .mjs imports:\n${missing.join('\n')}`);
console.info('Verified production .mjs dependencies');

