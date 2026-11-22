import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=path.resolve(process.argv[2]||process.cwd());
const dryRun=process.argv.includes('--dry-run');
const changes=[
  {
    path:'Module_2_Public_Website/src/components/SiteHeader.tsx',
    modify:s=>{
      const re=/^\s*\{href:'\/#top-100',label:'Rankings'\},\r?\n\s*\{href:'\/#discover',label:'Creators'\},\r?\n/m;
      if(re.test(s)) return s.replace(re,'');
      if(!s.includes("label:'Rankings'") && !s.includes("label:'Creators'"))return s;
      throw new Error('Unexpected nav structure, refusing to modify SiteHeader.tsx');
    },
    validate:s=>s.includes("label:'Home'")&&s.includes("label:'Events'")&&s.includes("label:'Satellite'")&&s.includes("label:'Insights'")&&s.includes("label:'About'")&&!s.includes("label:'Rankings'")&&!s.includes("label:'Creators'")&&s.includes("href=\"/#discover\"")
  },
  {
    path:'Module_2_Public_Website/tests/public-header-template.test.mjs',
    modify:s=>{
      const a="test('all seven tabs are sourced once from the same SiteHeader',()=>{";
      const b="for(const label of ['Home','Rankings','Creators','Events','Satellite','Insights','About'])assert.match(header,new RegExp(`label:'${label}'`));";
      if(s.includes(a)&&s.includes(b)) return s.replace(a,"test('all five primary tabs are sourced once from the same SiteHeader',()=>{").replace(b,"for(const label of ['Home','Events','Satellite','Insights','About'])assert.match(header,new RegExp(`label:'${label}'`));\n assert.doesNotMatch(header,/label:'(?:Rankings|Creators)'/);");
      if(s.includes('all five primary tabs')&&!s.includes('all seven tabs'))return s;
      throw new Error('Unexpected public header test structure, refusing to modify');
    },
    validate:s=>s.includes('all five primary tabs')&&s.includes('assert.doesNotMatch(header')
  },
  {
    path:'Module_2_Public_Website/tests/sleek-navigation.test.mjs',
    modify:s=>{
      const a="assert.match(head,/label:'Home'/);assert.match(head,/label:'Rankings'/);assert.match(head,/label:'Creators'/);";
      const b="assert.match(head,/label:'Home'/);assert.match(head,/label:'Events'/);assert.doesNotMatch(head,/label:'(?:Rankings|Creators)'/);";
      if(s.includes(a))return s.replace(a,b);
      if(s.includes(b))return s;
      throw new Error('Unexpected sleek navigation test structure, refusing to modify');
    },
    validate:s=>s.includes("assert.doesNotMatch(head,/label:'(?:Rankings|Creators)'/)")&&s.includes("assert.match(page,/id=\"top-100\"/)")
  }
];

const results=[];
for(const ch of changes){
  const filename=path.join(root,ch.path);
  if(!fs.existsSync(filename))throw new Error(`Missing file: ${filename}`);
  const before=fs.readFileSync(filename,'utf8');
  const committed=execFileSync('git',['show',`HEAD:${ch.path}`],{cwd:root,encoding:'utf8'});
  const expected=ch.modify(committed);
  const normalize=v=>v.replace(/\r\n/g,'\n');
  if(normalize(before)!==normalize(committed)&&normalize(before)!==normalize(expected))
    throw new Error(`Unrelated local edits detected in ${ch.path}; refusing to overwrite or commit them.`);
  const after=ch.modify(before);
  if(!ch.validate(after))throw new Error(`Validation failed: ${ch.path}`);
  results.push({filename,display:ch.path,before,after,changed:before!==after});
}
for(const r of results){
  console.log(`${r.changed?(dryRun?'WOULD UPDATE':'UPDATE'):'UNCHANGED'} ${r.display}`);
  if(r.changed&&!dryRun)fs.writeFileSync(r.filename,r.after,'utf8');
}
console.log(`\n${dryRun?'Dry run':'Applied'}: ${results.filter(r=>r.changed).length} files ${dryRun?'would change':'changed'}. Creator profiles, ranking pages, API, and homepage data were not touched.`);
