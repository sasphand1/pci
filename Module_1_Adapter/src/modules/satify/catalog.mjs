// Satify catalogue: cities, airports, routes and the signal library.
// A signal is one piece of data Satify can show or send. Packs are built from signals in the admin panel.
import {CITIES} from '../satellite/catalog.mjs';

export const SATIFY_CITIES=Object.freeze(Object.fromEntries(Object.keys(CITIES).map(id=>[id,id[0].toUpperCase()+id.slice(1)])));

/** ICAO airport per city for METAR visibility (measured at the airport). */
export const AIRPORTS=Object.freeze({lahore:'OPLA',karachi:'OPKC',islamabad:'OPIS',peshawar:'OPPS',quetta:'OPQT',multan:'OPMT',faisalabad:'OPFA',hyderabad:'OPKD'});

/** Motorway routes. Conditions are estimated from the airport cities at each end of the route. */
export const ROUTES=Object.freeze({
 m2:{label:'M-2 Lahore–Islamabad',cities:['lahore','islamabad']},
 m3:{label:'M-3 Lahore–Faisalabad–Multan',cities:['lahore','faisalabad','multan']},
 m5:{label:'M-5 Multan–Sukkur',cities:['multan']},
 m9:{label:'M-9 Karachi–Hyderabad',cities:['karachi','hyderabad']},
 n5:{label:'N-5 Karachi–Lahore–Peshawar',cities:['karachi','hyderabad','multan','lahore','islamabad','peshawar']}
});

export const BADGES=Object.freeze({
 measured:'Measured (satellite, sensor or station reading)',
 official:'Official (government notice or announced price)',
 forecast:'Forecast (weather or air-quality model)',
 estimate:'Estimate (Satify calculation, shown with its method)'
});

/** scope: city | pk (national) | route. optional: a pack still sends if this is missing (shown as the fallback text). */
export const SIGNALS=Object.freeze({
 aqi:{label:'Air quality (US AQI)',unit:'',scope:'city',badge:'forecast',source:'Copernicus CAMS'},
 aqi_label:{label:'Air quality level',unit:'',scope:'city',badge:'forecast',source:'Copernicus CAMS'},
 pm25:{label:'PM2.5',unit:'µg/m³',scope:'city',badge:'forecast',source:'Copernicus CAMS'},
 aqi_forecast_max:{label:'Peak AQI next 24h',unit:'',scope:'city',badge:'forecast',source:'Copernicus CAMS'},
 aqi_forecast_label:{label:'Smog level next 24h',unit:'',scope:'city',badge:'forecast',source:'Copernicus CAMS'},
 temp_now:{label:'Temperature now',unit:'°C',scope:'city',badge:'forecast',source:'MET Norway'},
 temp_max:{label:'Today’s high',unit:'°C',scope:'city',badge:'forecast',source:'MET Norway'},
 temp_min:{label:'Today’s low',unit:'°C',scope:'city',badge:'forecast',source:'MET Norway'},
 feels_max:{label:'Feels-like high',unit:'°C',scope:'city',badge:'forecast',source:'MET Norway'},
 rain_chance:{label:'Rain chance today',unit:'%',scope:'city',badge:'forecast',source:'MET Norway'},
 uv_max:{label:'UV index (clear-sky max)',unit:'',scope:'city',badge:'forecast',source:'MET Norway'},
 fog_pct:{label:'Fog cover now',unit:'%',scope:'city',badge:'forecast',source:'MET Norway'},
 visibility_km:{label:'Visibility at the airport',unit:'km',scope:'city',badge:'measured',source:'aviationweather.gov METAR',optional:true,fallback:'not reported'},
 fog_risk:{label:'Fog risk',unit:'',scope:'city',badge:'estimate',source:'Satify (METAR + MET Norway)'},
 fog_clear_time:{label:'Fog expected to clear',unit:'',scope:'city',badge:'forecast',source:'MET Norway fog forecast',optional:true,fallback:'no fog expected'},
 school_closure_chance:{label:'School closure chance',unit:'',scope:'city',badge:'estimate',source:'Satify prediction (smog, heat, fog)'},
 school_notice:{label:'Official school notice',unit:'',scope:'city',badge:'official',source:'Government notification (entered by Satify)',optional:true,manual:true,fallback:'none yet'},
 section144:{label:'Section 144 / restrictions',unit:'',scope:'city',badge:'official',source:'Government notification (entered by Satify)',optional:true,manual:true,fallback:'none'},
 usd_pkr:{label:'Dollar (SBP rate)',unit:'Rs',scope:'pk',badge:'official',source:'State Bank of Pakistan via Frankfurter',optional:true,fallback:'unavailable'},
 usd_pkr_open:{label:'Dollar (open market)',unit:'Rs',scope:'pk',badge:'official',source:'Forex Association rate (entered by Satify)',optional:true,manual:true,fallback:'not entered'},
 gold_usd_oz:{label:'Gold spot',unit:'$/oz',scope:'pk',badge:'measured',source:'xaus.com spot'},
 gold_tola:{label:'Gold 24k per tola',unit:'Rs',scope:'pk',badge:'estimate',source:'Spot gold × dollar rate (Sarafa rate when entered)',manual:true,optional:true,fallback:'unavailable'},
 petrol_price:{label:'Petrol per litre',unit:'Rs',scope:'pk',badge:'official',source:'Government price notification (entered by Satify)',optional:true,manual:true,fallback:'not entered'},
 diesel_price:{label:'Diesel per litre',unit:'Rs',scope:'pk',badge:'official',source:'Government price notification (entered by Satify)',optional:true,manual:true,fallback:'not entered'},
 top_trend:{label:'Top trend today',unit:'',scope:'pk',badge:'measured',source:'Entered by Satify from public trend lists',optional:true,manual:true,fallback:'—'},
 route_visibility_km:{label:'Lowest visibility on the route',unit:'km',scope:'route',badge:'measured',source:'aviationweather.gov METAR (route-end airports)'},
 route_fog_clear_time:{label:'Fog expected to clear on the route',unit:'',scope:'route',badge:'forecast',source:'MET Norway fog forecast',optional:true,fallback:'no fog expected'},
 motorway_status:{label:'Route status',unit:'',scope:'route',badge:'estimate',source:'Satify (airport visibility + NHMP notices)'},
 nhmp_status:{label:'NHMP notice',unit:'',scope:'route',badge:'official',source:'NHMP announcement (entered by Satify)',optional:true,manual:true,fallback:'no closure announced'}
});

export function isSignal(id){return Object.hasOwn(SIGNALS,id);}
export function scopeLabel(scope){
 if(scope==='pk')return 'Pakistan';
 if(Object.hasOwn(SATIFY_CITIES,scope))return SATIFY_CITIES[scope];
 if(Object.hasOwn(ROUTES,scope))return ROUTES[scope].label;
 return scope;
}
export function scopesFor(scopeType){
 return scopeType==='route'?Object.keys(ROUTES):scopeType==='national'?['pk']:Object.keys(SATIFY_CITIES);
}
