/** Independent, read-only satellite abuse protection. Never permits satellite requests
 * when rate-limit storage is unavailable; unrelated PCI routes remain unchanged. */
export const SATELLITE_RATE_WINDOW_SECONDS = 60;
export const SATELLITE_RATE_MAXIMUM = 60;
export const SATELLITE_MAX_UPSTREAM_BYTES = 8 * 1024 * 1024;
export function isPublicSatelliteRead(path, method) {
  return /^\/api\/v1\/satellite(?:\/|$)/.test(path) && (method === 'GET' || method === 'HEAD');
}
export async function satellitePermission(limiter,key) {
  try {return await limiter(key,SATELLITE_RATE_MAXIMUM,SATELLITE_RATE_WINDOW_SECONDS) ? 'allow' : 'rate_limited';}
  catch {return 'unavailable';}
}
export async function readLimitedText(response, maxBytes=SATELLITE_MAX_UPSTREAM_BYTES) {
  if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
  const advertised = response.headers.get('content-length');
  if (advertised !== null && Number(advertised) > maxBytes) throw new Error('Satellite upstream response too large');
  if (!response.body) throw new Error('Missing satellite response body');
  const reader=response.body.getReader(); const chunks=[]; let total=0;
  try {
    while (true) {
      const {done,value}=await reader.read();if(done)break;
      total+=value.byteLength;
      if(total>maxBytes) throw new Error('Satellite upstream response too large');
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const merged=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){merged.set(chunk,offset);offset+=chunk.byteLength;}
  return new TextDecoder('utf-8',{fatal:true}).decode(merged);
}
