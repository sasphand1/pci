import test from 'node:test';
import assert from 'node:assert/strict';
import {goOutScore,airPenalty,heatPenalty,smogHeatWatch,dailyMaxAqi,averageAqi,safetyToday,irrigationAdvice,sprayWindows,heatStress,solarCard,riskCard,logisticsCard,powerDemandCard,spaceWeatherCard,weeklyRankings,assembleInsights,distanceKm,nearestRiver,riverStatus,dayName} from '../src/modules/satellite/insights.mjs';

const day=(date,o={})=>({date,maxC:30,minC:18,feelsLikeMaxC:31,rainMm:0,rainChancePct:5,uvIndexMax:5,windMaxKmh:10,weatherCode:1,...o});
const week=(o={})=>['2026-11-23','2026-11-24','2026-11-25','2026-11-26','2026-11-27','2026-11-28','2026-11-29'].map(d=>day(d,o));
const weather=(o={},daily=week())=>({observedAt:'2026-11-23T10:00:00Z',current:{temperatureC:25,feelsLikeC:25},daily,heatDays:0,...o});
const air=(aqi,extra={})=>({observedAt:'2026-11-23T10:00:00Z',values:{us_aqi:aqi,dust:10,pm10:40,...extra},next24h:{maxUsAqi:aqi+10}});

test('penalty curves are monotonic and capped',()=>{
 let prev=-1;for(let a=0;a<=500;a+=10){const p=airPenalty(a);assert.ok(p>=prev);prev=p;}assert.equal(airPenalty(500),75);
 assert.equal(heatPenalty(30),0);assert.equal(heatPenalty(40),20);assert.equal(heatPenalty(60),40);assert.equal(heatPenalty(0),10);
});
test('go-out score: clean mild day is good, smoggy hot day is avoid',()=>{
 const good=goOutScore(air(30),weather());assert.equal(good.score,100);assert.equal(good.level,'good');assert.deepEqual(good.advice,['No special precautions needed.']);
 const bad=goOutScore(air(320),weather({},week({feelsLikeMaxC:45,uvIndexMax:11})));
 assert.equal(bad.level,'avoid');assert.ok(bad.score<35);assert.ok(bad.advice.some(a=>/N95/.test(a)));assert.ok(bad.advice.some(a=>/12 to 4 pm/.test(a)));
 assert.ok(bad.score>=0&&bad.score<=100);
});
test('go-out score is partial with one input and null with none',()=>{
 assert.equal(goOutScore(null,null),null);
 const onlyAir=goOutScore(air(168),null);assert.equal(onlyAir.partial,true);assert.equal(onlyAir.score,Math.round(100-(40+18*0.4)));
});
test('daily max and average AQI from hourly history',()=>{
 const h=[{observedAt:'2026-11-20T01:00:00Z',values:{us_aqi:100}},{observedAt:'2026-11-20T13:00:00Z',values:{us_aqi:180}},{observedAt:'2026-11-21T01:00:00Z',values:{us_aqi:90}},{observedAt:'2026-11-21T02:00:00Z',values:{us_aqi:null}}];
 assert.deepEqual(dailyMaxAqi(h),[{date:'2026-11-20',maxUsAqi:180},{date:'2026-11-21',maxUsAqi:90}]);
 assert.equal(averageAqi(h),123);
 const w=smogHeatWatch(air(160),h,weather({},week({feelsLikeMaxC:41})));
 assert.equal(w.smogDaysPast7,1);assert.equal(w.heatDaysNext7,7);assert.equal(w.next24hMaxAqi,170);
});
test('geometry helpers',()=>{
 assert.ok(Math.abs(distanceKm(31.52,74.36,24.86,67.01)-1030)<30);
 const r=nearestRiver(31.5,74.3,[{river:'Ravi',place:'Lahore',latitude:31.61,longitude:74.3,peakToTodayRatio:1},{river:'Indus',place:'Kotri',latitude:25.36,longitude:68.31}]);
 assert.equal(r.place,'Lahore');assert.equal(nearestRiver(31.5,74.3,[{latitude:24,longitude:67}]),null);
 assert.equal(riverStatus(3.2),'flood_watch');assert.equal(riverStatus(1.6),'rising');assert.equal(riverStatus(1),'normal');assert.equal(riverStatus(null),'unknown');
 assert.equal(dayName('2026-11-27'),'Fri');
});
test('safety today escalates on red alerts, big nearby quakes and flood-watch rivers',()=>{
 const now=Date.parse('2026-11-25T12:00:00Z');
 assert.equal(safetyToday(31.5,74.3,{},now).level,'clear');
 assert.equal(safetyToday(31.5,74.3,{alerts:[{name:'Flood',alertLevel:'Red',affectsPakistan:true}]},now).level,'warning');
 assert.equal(safetyToday(31.5,74.3,{alerts:[{name:'Quake',alertLevel:'Green',latitude:10,longitude:10}]},now).level,'clear');
 assert.equal(safetyToday(31.5,74.3,{quakes:[{magnitude:4.6,latitude:32,longitude:74,observedAt:'2026-11-24T00:00:00Z'}]},now).level,'watch');
 assert.equal(safetyToday(31.5,74.3,{quakes:[{magnitude:6,latitude:32,longitude:74,observedAt:'2026-11-01T00:00:00Z'}]},now).level,'clear');
 assert.equal(safetyToday(31.5,74.3,{rivers:[{river:'Ravi',place:'Lahore',latitude:31.6,longitude:74.3,dischargeM3s:100,peakToTodayRatio:4,peak30:{max:400,date:'2026-12-01'}}]},now).level,'warning');
});
test('farm advice: irrigation, spray days and heat stress',()=>{
 assert.equal(irrigationAdvice([{value:0},{value:1}],weather({},week({maxC:36}))).decision,'irrigate');
 assert.equal(irrigationAdvice([{value:0}],weather({},week({rainMm:4}))).decision,'wait');
 assert.equal(irrigationAdvice([{value:30}],weather()).decision,'check');
 assert.equal(irrigationAdvice([],null).decision,'unknown');
 const s=sprayWindows(weather({},[day('2026-11-26'),day('2026-11-27',{windMaxKmh:30}),day('2026-11-28',{rainChancePct:60})]));
 assert.deepEqual(s.days.map(d=>d.day),['Thu']);
 assert.equal(heatStress(weather({},week({maxC:42}))).days,7);
});
test('industry cards',()=>{
 const sol=solarCard([{value:5},{value:5},{value:4}],air(80,{dust:150}),weather());
 assert.equal(sol.index,107);assert.equal(sol.cleaning,'clean');
 assert.equal(solarCard([],air(80,{dust:150}),weather({},week({rainMm:3}))).cleaning,'rain_will_rinse');
 assert.equal(riskCard(31.5,74.3,{weather:weather({heatDays:3})}).heat,'high');
 assert.equal(riskCard(31.5,74.3,{weather:weather()}).overall,'low');
 assert.equal(logisticsCard(31.5,74.3,{air:air(100,{dust:350}),weather:weather()}).level,'watch');
 assert.equal(logisticsCard(31.5,74.3,{weather:weather(),alerts:[{alertLevel:'Orange',affectsPakistan:true}]}).level,'disruption_likely');
 assert.deepEqual(powerDemandCard(weather({},[day('2026-11-27',{feelsLikeMaxC:41})])).spikeDays,['Fri']);
 assert.equal(spaceWeatherCard({kp:5.3}).level,'storm');assert.equal(spaceWeatherCard(null).level,'unknown');
});
test('weekly rankings need three cities and real rain',()=>{
 const r=weeklyRankings([{city:'lahore',avgAqi:180,maxFeelsLikeC:30,rainMm:0,goOut:40},{city:'quetta',avgAqi:40,maxFeelsLikeC:20,rainMm:0,goOut:90},{city:'karachi',avgAqi:90,maxFeelsLikeC:35,rainMm:0,goOut:70}]);
 const by=Object.fromEntries(r.map(x=>[x.id,x]));
 assert.equal(by.cleanest_air.winner.city,'quetta');assert.equal(by.worst_smog.winner.city,'lahore');assert.equal(by.hottest.winner.city,'karachi');
 assert.equal(by.most_rain.winner,null);assert.equal(by.best_go_out.list.length,3);
 assert.equal(weeklyRankings([{city:'a',avgAqi:1},{city:'b',avgAqi:2}])[0].winner,null);
});
test('assembly builds every card per city and stays honest with no data',()=>{
 const snap=assembleInsights({cities:{lahore:{lat:31.52,lon:74.36,air:air(160),weather:weather(),airHistory:[],rainPast:[],solar:[]},karachi:{lat:24.86,lon:67.01}},kp:{kp:2}},Date.parse('2026-11-25T12:00:00Z'));
 assert.equal(snap.cities.lahore.goOut.level,'fair');assert.equal(snap.cities.lahore.goOut.score,56);assert.equal(snap.cities.karachi.goOut,null);
 for(const k of ['solar','risk','logistics','power','space','health'])assert.ok(snap.cities.lahore.industry[k].label,k);
 for(const k of ['irrigation','spray','heat','river'])assert.ok(snap.cities.lahore.farm[k].label,k);
 assert.equal(snap.rankings.length,5);assert.match(snap.disclaimer,/Not official/);
});
