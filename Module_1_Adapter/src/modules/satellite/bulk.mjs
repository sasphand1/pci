/** Parameterized batch SQL: bounded to 200 observations per DB round trip. */
export const SATELLITE_BATCH_SIZE = 200;
export const SATELLITE_PROVIDER_IDS = Object.freeze(['firms','power','eonet','usgs','gibs','gpm','airquality','weather','flood','gdacs','swpc','celestrak','openaq']);
export const SATELLITE_METRICS = Object.freeze(['fire','rainfall','solar','natural_event','imagery','earthquake','air_quality','weather','river_flow','disaster_alert','space_weather','orbit','aq_station']);
export function buildObservationBatch(provider, observations) {
  if (!SATELLITE_PROVIDER_IDS.includes(provider)) throw Error('Unsupported satellite provider');
  if (!Array.isArray(observations) || observations.length<1 || observations.length>SATELLITE_BATCH_SIZE) throw Error('Satellite batch out of bounds');
  const values=[];
  const tuples=observations.map((record,index)=>{
    if (!SATELLITE_METRICS.includes(record.metric)||typeof record.location!=='string'||typeof record.observationKey!=='string'||!Number.isFinite(Date.parse(record.observedAt))) throw Error('Invalid satellite observation');
    values.push(provider,record.metric,record.location,record.observationKey,record.observedAt,JSON.stringify(record.payload));
    const n=index*6;return `($${n+1},$${n+2},$${n+3},$${n+4},$${n+5},$${n+6}::jsonb)`;
  });
  return {
    sql:`INSERT INTO satellite.observations(provider,metric,location,observation_key,observed_at,payload) VALUES ${tuples.join(',')} ON CONFLICT DO NOTHING`,
    values
  };
}
