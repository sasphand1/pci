/** Parameterized batch SQL: bounded to 200 observations per DB round trip. */
export const SATELLITE_BATCH_SIZE = 200;
export function buildObservationBatch(provider, observations) {
  if (!['firms','power','eonet','gibs','gpm','sentinel1','sentinel2','sentinel5p'].includes(provider)) throw Error('Unsupported satellite provider');
  if (!Array.isArray(observations) || observations.length<1 || observations.length>SATELLITE_BATCH_SIZE) throw Error('Satellite batch out of bounds');
  const values=[];
  const tuples=observations.map((record,index)=>{
    if (!['fire','rainfall','solar','natural_event','scene','imagery'].includes(record.metric)||typeof record.location!=='string'||typeof record.observationKey!=='string'||!Number.isFinite(Date.parse(record.observedAt))) throw Error('Invalid satellite observation');
    values.push(provider,record.metric,record.location,record.observationKey,record.observedAt,JSON.stringify(record.payload));
    const n=index*6;return `($${n+1},$${n+2},$${n+3},$${n+4},$${n+5},$${n+6}::jsonb)`;
  });
  return {
    sql:`INSERT INTO satellite.observations(provider,metric,location,observation_key,observed_at,payload) VALUES ${tuples.join(',')} ON CONFLICT DO NOTHING`,
    values
  };
}
