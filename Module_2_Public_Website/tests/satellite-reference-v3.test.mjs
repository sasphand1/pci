import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('reference dashboard is default and detailed sections remain accessible',()=>{
 const s=read('../src/components/SatelliteDashboard.tsx');
 assert.match(s,/data-satellite-revision="reference-v3"/);
 assert.match(s,/useState\(false\)/);
 assert.ok(s.indexOf('pci-sat-preview-grid')<s.indexOf('<details ref={detailRef}'));
 assert.match(s,/detailRef.current.open=true/);
 for(const id of ['pci-sat-history','pci-sat-industry','pci-sat-rankings','pci-sat-sources'])assert.ok(s.includes(id));
});
test('reference stylesheet uses three-column stage and five desktop previews',()=>{
 const css=read('../packages/ui/src/styles/satellite-reference.css');
 assert.match(css,/minmax\(0,22fr\) minmax\(0,46fr\) minmax\(0,32fr\)/);
 assert.match(css,/repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(css,/data-score-band="avoid"/);
});
test('raster imagery is restricted to Pakistan detail mode and iframe is versioned',()=>{
 const map=read('../public/satellite-map.html');
 assert.match(map,/GLOBE=\{hotspots:true,events:true,imagery:false,gpm:false\}/);
 assert.match(map,/type:mode==='pakistan'\?'mercator':'globe'/);
 assert.match(read('../src/components/SatelliteDashboard.tsx'),/satellite-map.html\?v=reference-v3/);
});
