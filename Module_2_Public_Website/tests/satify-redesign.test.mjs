import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const qrSource=readFileSync(new URL('../src/lib/qr.ts',import.meta.url),'utf8');
const {qrMatrix,qrSvgPath}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(qrSource)).toString('base64'));
const ui=readFileSync(new URL('../src/components/SatifyPage.tsx',import.meta.url),'utf8');
const page=readFileSync(new URL('../src/app/satify/page.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../packages/ui/src/styles/satify.css',import.meta.url),'utf8');
test('Signals page does not embed or fetch the old satellite dashboard',()=>{assert.doesNotMatch(page,/SatelliteDashboard|api\/v1\/satellite/);assert.match(page,/Pulsr Signals/);});
test('alert discovery opens a native modal and uses existing endpoints',()=>{assert.match(ui,/<dialog ref=\{dialog\}/);assert.match(ui,/\.showModal\(\)/);assert.match(ui,/what=interest/);assert.match(ui,/what=schools/);assert.match(ui,/https:\/\/wa\.me\//);assert.match(css,/\.ps-modal::backdrop/);});
test('city changes clear stale values and cancel the earlier request',()=>{assert.match(ui,/request\.current\?\.abort\(\)/);assert.match(ui,/setCity\(c\);setValues\(\[\]\)/);assert.match(ui,/if\(!controller\.signal\.aborted\)setValues/);});
test('QR encoder produces distinct square codes for different join links',()=>{const a='https://wa.me/923001234567?text=JOIN%20PARENTS%20LAHORE',b=a.replace('LAHORE','KARACHI');const m=qrMatrix(a);assert.ok(m.length>=21);assert.ok(m.every(r=>r.length===m.length));assert.notDeepEqual(m,qrMatrix(b));assert.ok(qrSvgPath(a).path.length>0);});
test('two-section editorial layout contains the five-slide spotlight and service index',()=>{assert.equal((ui.match(/<section className="ps-section"/g)||[]).length,2);for(const token of ['ps-anchors','ps-dashboard','ps-spotlight','ps-weather-stack','ps-ledger','ps-list','ps-pass','ps-reach'])assert.ok(ui.includes(token),token);assert.match(css,/grid-template-columns:minmax\(0,5fr\) minmax\(0,4fr\) minmax\(0,3fr\)/);assert.match(css,/grid-template-columns:minmax\(0,7fr\) minmax\(0,5fr\)/);});
test('no derived scientific values or fake reach metrics are rendered',()=>{assert.doesNotMatch(ui,/Math\.round|AirGauge|14,820|186,400|strokeDasharray/);assert.match(ui,/Public totals unavailable/);assert.match(ui,/route_visibility_km/);assert.match(ui,/route_fog_clear_time/);assert.match(ui,/motorway_status/);assert.match(ui,/nhmp_status/);});
test('preview and modal use functional QR and existing pack catalogue',()=>{assert.match(ui,/<Qr text=\{previewLink\}/);assert.match(ui,/packs\.filter/);assert.match(ui,/onMouseEnter/);assert.match(css,/ps-modal::backdrop/);});

test('all 29 catalogue signals are represented in anchor, spotlight or supporting panels',()=>{const layout=ui.slice(ui.indexOf('const SLIDES='));for(const id of ['aqi','aqi_label','pm25','aqi_forecast_max','aqi_forecast_label','temp_now','temp_max','temp_min','feels_max','rain_chance','uv_max','fog_pct','visibility_km','fog_risk','fog_clear_time','school_closure_chance','school_notice','section144','usd_pkr','usd_pkr_open','gold_usd_oz','gold_tola','petrol_price','diesel_price','top_trend','route_visibility_km','route_fog_clear_time','motorway_status','nhmp_status'])assert.ok(layout.includes("'"+id+"'"),id);});
