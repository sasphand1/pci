#!/usr/bin/env node
// Run from PCI_Clean root. Changes ONLY Module_2_Public_Website visual files.
import {readFileSync,writeFileSync,copyFileSync,existsSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
const root=process.cwd();
const modulePath=join(root,'Module_2_Public_Website');
const source=join(root,'PCI_UI_PAYLOAD','Module_2_Public_Website');
const rel=[
 'src/app/page.tsx',
 'src/components/SiteHeader.tsx',
 'packages/ui/src/styles/ranking-wheel.css',
 'packages/ui/src/styles/premium-home.css',
 'packages/ui/src/styles/sleek-rails.css',
 'packages/ui/src/styles/pci-reference-adaptation.css'
];
if(!existsSync(join(modulePath,'src/components/UnifiedCreatorExperience.tsx')) || !existsSync(join(modulePath,'src/components/CreatorDiscoveryRows.tsx'))){
 console.error('STOP: Current unified PCI website components not found. No changes made.');process.exit(1);
}
const stylePath=join(modulePath,'packages/ui/src/styles.css');
if(!existsSync(stylePath) || !readFileSync(stylePath,'utf8').includes("@import './styles/unified.css'")){
 console.error('STOP: Current shared UI style imports differ. No changes made.');process.exit(1);
}
const backupSuffix='.pre_pci_ui_reference.bak';
for(const f of rel){const dest=join(modulePath,f),src=join(source,f);
 if(!existsSync(src)){console.error('Missing payload:',f);process.exit(1);}
 mkdirSync(dirname(dest),{recursive:true});
 if(existsSync(dest)&&!existsSync(dest+backupSuffix))copyFileSync(dest,dest+backupSuffix);
 copyFileSync(src,dest);
 console.log('Installed',f);
}
if(!existsSync(stylePath+backupSuffix))copyFileSync(stylePath,stylePath+backupSuffix);
let styles=readFileSync(stylePath,'utf8');
for(const name of ['premium-home','sleek-rails','pci-reference-adaptation']){
 const line=`@import './styles/${name}.css';`;
 if(!styles.includes(line))styles+='\n'+line;
}
writeFileSync(stylePath,styles);
console.log('Visual update applied. No backend or admin files changed. Run Module_2_Public_Website npm run check before committing.');
