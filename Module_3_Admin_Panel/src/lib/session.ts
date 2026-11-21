// Pure timing rules for the idle warning. No browser APIs: time comes in as arguments so it can be tested.

export const WARN_SECONDS=60;
export const DEFAULT_IDLE_SECONDS=30*60;

export type IdleState={kind:'active'}|{kind:'idle-warning';secondsLeft:number}|{kind:'idle-expired'}|{kind:'limit-warning';secondsLeft:number}|{kind:'limit-expired'};

/**
 * What the screen should do right now.
 * idleSeconds: how long without activity ends the session. lastActivityMs: when the user last did something.
 * expiresAtMs: absolute end of the session (null when unknown).
 */
export function idleState(nowMs:number,lastActivityMs:number,idleSeconds:number,expiresAtMs:number|null):IdleState{
 if(expiresAtMs!==null&&Number.isFinite(expiresAtMs)){
  const limit=Math.ceil((expiresAtMs-nowMs)/1000);
  if(limit<=0)return {kind:'limit-expired'};
  const idleLeft=Math.ceil(idleSeconds-(nowMs-lastActivityMs)/1000);
  if(idleLeft<=0)return {kind:'idle-expired'};
  // The nearer end decides what the person is warned about.
  if(limit<=WARN_SECONDS&&limit<=idleLeft)return {kind:'limit-warning',secondsLeft:limit};
  if(idleLeft<=WARN_SECONDS)return {kind:'idle-warning',secondsLeft:idleLeft};
  return {kind:'active'};
 }
 const idleLeft=Math.ceil(idleSeconds-(nowMs-lastActivityMs)/1000);
 if(idleLeft<=0)return {kind:'idle-expired'};
 if(idleLeft<=WARN_SECONDS)return {kind:'idle-warning',secondsLeft:idleLeft};
 return {kind:'active'};
}

/** "1:05", "0:09" */
export function clock(seconds:number):string{
 const s=Math.max(0,Math.floor(seconds));
 return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}
