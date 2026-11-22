/** Provider-side minimum request spacing. The UI cannot override these floors. */
export const SATELLITE_MIN_INTERVAL_MINUTES = Object.freeze({
  firms:180,
  power:1440,
  eonet:360,
  gibs:1440,
  gpm:360,
  sentinel1:1440,
  sentinel2:1440,
  sentinel5p:1440,
  usgs:60,
  landsat:1440,
  ecostress:1440,
  smap:1440,
  blackmarble:1440
});
export function minimumIntervalMinutes(id){
  const value=SATELLITE_MIN_INTERVAL_MINUTES[id];
  if(!Number.isInteger(value))throw Error('Unknown satellite provider');
  return value;
}
export function effectiveIntervalMinutes(id,requested){
  if(!Number.isInteger(requested)||requested<1||requested>10080)throw Error('Invalid refresh interval');
  return Math.max(requested,minimumIntervalMinutes(id));
}
export function isDue(lastAttemptAt,id,requested,nowMs=Date.now()){
  const minutes=effectiveIntervalMinutes(id,requested);
  if(lastAttemptAt===null||lastAttemptAt===undefined)return true;
  const timestamp=Date.parse(lastAttemptAt);
  return Number.isFinite(timestamp) && timestamp<=nowMs-minutes*60_000;
}
