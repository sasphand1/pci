import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const base=path.dirname(fileURLToPath(import.meta.url));
const repo=process.cwd();
const target=path.join(repo,'Module_2_Public_Website','public','events-radar.html');
const testTarget=path.join(repo,'Module_2_Public_Website','tests','events-compact-pins.test.mjs');
if(!fs.existsSync(target))throw Error('Run from PCI_Clean root. Missing '+target);
let s=fs.readFileSync(target,'utf8');
const marker='/* PCI_EVENTS_COMPACT_RED_PIN_V1 */';
if(s.includes(marker)){
 console.log('Compact pin patch already installed; no duplicate changes.');
} else {
 const original=s;
 const needle="el.addEventListener('click',()=>{state.category=cat.id;state.pinnedId=null;refresh();});";
 if(!s.includes(needle))throw Error('Category handler changed. Nothing modified.');
 s=s.replace(needle,"el.addEventListener('click',()=>{state.category=cat.id;state.pinnedId=null;refresh();focusMap();});");
 const coord="if(!Number.isFinite(lat)||!Number.isFinite(lng)||!Number.isFinite(t)||!Number.isFinite(end)||end<=Date.now())return null;";
 if(!s.includes(coord))throw Error('Event coordinate filter changed. Nothing modified.');
 s=s.replace(coord,"if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<23||lat>38||lng<60||lng>78||!Number.isFinite(t)||!Number.isFinite(end)||end<=Date.now())return null;");
 const styles=`\n${marker}
/* Minimal round-headed location pin, 10px red head / narrow 9px stem. No diamond. */
.event-marker__hotspot{padding:0 8px 5px!important;min-width:28px;min-height:35px;justify-content:flex-end}
.event-marker__diamond-wrap{height:20px!important;width:18px!important;display:block!important;position:relative!important;overflow:visible}
.event-marker__diamond{position:absolute!important;display:block!important;top:0!important;left:4px!important;width:10px!important;height:10px!important;border-radius:50%!important;border:1px solid #ffb2b6!important;transform:none!important;background:radial-gradient(circle at 33% 26%,#ffd4d5 0%,#ff5d65 29%,#eb1233 65%,#a30820 100%)!important;box-shadow:0 0 5px #fa274b99!important;animation:pciSmallRedBlink 1.75s ease-in-out infinite!important}
.event-marker__diamond:before{display:none!important}
.event-marker__diamond-wrap:before,.event-marker__diamond-wrap:after{content:none!important;display:none!important}
.event-marker__beam{display:block!important;position:absolute!important;top:10px!important;left:8px!important;width:2px!important;height:9px!important;opacity:1!important;background:linear-gradient(#e5e7ec,#677b8a)!important;box-shadow:1px 0 1px #0007!important;transform:rotate(12deg);transform-origin:top}
.event-marker__title{display:none!important;position:absolute;bottom:calc(100% + 3px);left:50%;transform:translateX(-50%)!important;max-width:170px;white-space:normal;text-align:center;font-size:9px!important;line-height:1.25!important;letter-spacing:.05px!important;text-transform:none!important;background:#061b2cf0;padding:5px 7px;border-radius:5px;border:1px solid #2c6077;color:#f0faff!important;text-shadow:none!important;filter:none!important;pointer-events:none}
.event-marker__hotspot:hover .event-marker__title,.event-marker__hotspot:focus-visible .event-marker__title,.event-marker.is-open .event-marker__title{display:block!important}
@keyframes pciSmallRedBlink{0%,100%{opacity:1;box-shadow:0 0 4px #fc354f99,0 0 7px #fc354f55}50%{opacity:.55;box-shadow:0 0 2px #fc354f55}}
@media(prefers-reduced-motion:reduce){.event-marker__diamond{animation:none!important}}
`;
 const close='</style>';
 if(!s.includes(close))throw Error('CSS style block missing. Nothing modified.');
 s=s.replace(close,styles+'\n'+close);
 if(!s.includes(marker)||!s.includes('refresh();focusMap();'))throw Error('Patch validation failed. Nothing modified.');
 const backup=target+'.before-compact-pins.bak';
 if(!fs.existsSync(backup))fs.writeFileSync(backup,original);
 fs.writeFileSync(target,s);
 console.log('Patched '+target);console.log('Original backup: '+backup);
}
const localTest=path.join(base,'events-compact-pins.test.mjs');
if(!fs.existsSync(localTest))throw Error('Missing bundled test fixture');
fs.mkdirSync(path.dirname(testTarget),{recursive:true});
fs.copyFileSync(localTest,testTarget);
console.log('Installed verification test: '+testTarget);
