/** Provider-side minimum request spacing. The UI cannot override these floors. */
export const SATELLITE_MIN_INTERVAL_MINUTES = Object.freeze({
  firms:180,power:1440,eonet:360,usgs:60,gibs:1440,gpm:360,
  airquality:60,weather:180,flood:1440,gdacs:60,swpc:180,celestrak:360,openaq:60
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
