import test from 'node:test';
import assert from 'node:assert/strict';
import {metarVisibilityKm,parseMetar,parseFrankfurter,parseErApi,parseXaus} from '../src/modules/satify/sources.mjs';
import {fogRisk,fogClearTime,schoolClosureChance,motorwayStatus,renderTemplate,evalRule,dailyDue,parseCommand,normalisePhone,missingSignals,deriveCity,deriveRoutes,flattenForTemplate} from '../src/modules/satify/derive.mjs';
import {parseMetno,symbolToCode,heatIndexC} from '../src/modules/satellite/metno.mjs';

test('METAR visibility: metres, 9999, CAVOK, miles',()=>{
 assert.equal(metarVisibilityKm('OPLA 260300Z 00000KT 0200 FG NSC 09/09 Q1021',null),0.2);
 assert.equal(metarVisibilityKm('OPIS 260300Z 36004KT 9999 FEW040 12/04 Q1020',null),10);
 assert.equal(metarVisibilityKm('OPKC 260300Z 05005KT CAVOK 20/10 Q1015',null),10);
 assert.equal(metarVisibilityKm('',"6+"),10);
 assert.equal(metarVisibilityKm(null,1),1.6);
});
test('parseMetar keeps the latest report per airport',()=>{
 const r=parseMetar([{icaoId:'OPLA',obsTime:1000,rawOb:'OPLA 00000KT 0800 FG'},{icaoId:'OPLA',obsTime:2000,rawOb:'OPLA 00000KT 1500 BR'}]);
 assert.equal(r[0].scope,'lahore');assert.equal(r[0].value,1.5);assert.equal(r[0].badge,'measured');
});
test('FX and gold parsers reject implausible values',()=>{
 assert.equal(parseFrankfurter({rate:280.12,date:'2026-11-25'})[0].value,280.12);
 assert.throws(()=>parseFrankfurter({rate:0.0036}));
 assert.equal(parseErApi({result:'success',rates:{PKR:281},time_last_update_unix:1})[0].value,281);
 const g=parseXaus({spot_usd_oz:4000,xau:{price:4000*280,currency:'PKR'},price_as_of:'2026-11-26T00:00:00Z'});
 assert.equal(g[1].signal,'gold_tola');assert.equal(g[1].badge,'estimate');assert.ok(g[1].value>400000&&g[1].value<425000);
});
test('fog, closure and motorway rules',()=>{
 assert.equal(fogRisk(0.5,null,null),'High');assert.equal(fogRisk(5,25,50),'Medium');assert.equal(fogRisk(10,0,40),'Low');
 const t0=Date.parse('2026-11-26T00:00:00Z');
 const hourly=[0,1,2,3,4,5].map(h=>({at:new Date(t0+h*3600000).toISOString(),fogPct:h<4?60:5}));
 assert.equal(fogClearTime(hourly,t0),'09:00');
 assert.equal(fogClearTime([{at:new Date(t0).toISOString(),fogPct:0}],t0),null);
 assert.equal(schoolClosureChance({aqiForecastMax:380,tempMax:20,fogRisk:'Low'}),'High');
 assert.equal(schoolClosureChance({aqiForecastMax:120,tempMax:20,fogRisk:'High'}),'Medium');
 assert.equal(motorwayStatus(0.4,null),'Dense fog: closures likely');
 assert.equal(motorwayStatus(10,'M-2 closed from Lahore to Kot Momin'),'Closed (NHMP notice)');
});
test('templates, rules and daily window',()=>{
 const s={aqi:{value:312,text:null,badge:'forecast',source:'x',observedAt:new Date().toISOString()}};
 assert.equal(renderTemplate('{city}: AQI {aqi}, petrol {petrol_price} {nope}','lahore',s),'Lahore: AQI 312, petrol not entered {nope}');
 assert.equal(evalRule({signal:'aqi',op:'>=',value:300},s),'ge:300');
 assert.equal(evalRule({signal:'aqi',op:'<=',value:300},s),null);
 assert.deepEqual(missingSignals(['aqi','temp_max','petrol_price'],s),['temp_max']);
 assert.equal(dailyDue('07:00',Date.parse('2026-11-26T02:10:00Z')),true);
 assert.equal(dailyDue('07:00',Date.parse('2026-11-26T03:10:00Z')),false);
 assert.equal(flattenForTemplate('a\nb\n\nc'),'a · b · c');
});
test('WhatsApp commands and phone numbers',()=>{
 assert.deepEqual(parseCommand('join parents lahore'),{type:'join',code:'PARENTS',place:'lahore'});
 assert.deepEqual(parseCommand('JOIN MOTORWAY M-2'),{type:'join',code:'MOTORWAY',place:'m2'});
 assert.deepEqual(parseCommand('stop'),{type:'stop',code:null});
 assert.equal(normalisePhone('0300 1234567'),'923001234567');
 assert.equal(normalisePhone('+92 300 1234567'),'923001234567');
 assert.equal(normalisePhone('12'),null);
});
test('MET Norway parser produces the insights payload shape',()=>{
 const t0=Date.parse('2026-11-26T00:00:00Z');
 const ts=[0,1,2].map(h=>({time:new Date(t0+h*3600000).toISOString(),data:{instant:{details:{air_temperature:10+h,relative_humidity:90,wind_speed:2,fog_area_fraction:h<2?70:0,ultraviolet_index_clear_sky:1}},next_1_hours:{summary:{symbol_code:'fog'},details:{precipitation_amount:0,probability_of_precipitation:5}}}}));
 const [o]=parseMetno({properties:{meta:{updated_at:'2026-11-26T00:00:00Z'},timeseries:ts}},'lahore',t0);
 assert.equal(o.payload.current.temperatureC,10);assert.equal(o.payload.daily[0].maxC,12);assert.equal(o.payload.current.weatherCode,45);
 assert.equal(o.payload.fogHourly.length,3);assert.equal(symbolToCode('heavyrainshowers_day'),65);assert.equal(heatIndexC(20,50),20);
 const d=deriveCity('lahore',{weather:o.payload,air:{values:{us_aqi:320,pm2_5:200},next24h:{maxUsAqi:410}},visibilityKm:0.3},t0);
 const by=Object.fromEntries(d.map(x=>[x.signal,x]));
 assert.equal(by.aqi_label.text,'Hazardous');assert.equal(by.fog_risk.text,'High');assert.equal(by.school_closure_chance.text,'High');assert.equal(by.fog_clear_time.text,'07:00');
 const routes=deriveRoutes({lahore:0.3,islamabad:4},{lahore:'07:00',islamabad:null});
 const m2=routes.filter(r=>r.scope==='m2');assert.equal(m2.find(r=>r.signal==='route_visibility_km').value,0.3);
});
