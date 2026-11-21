// Pure session timing rules for the admin panel. No redis, no clock: the caller passes the time in.

/** Seconds a session may still live: the shorter of "idle window from now" and "time left until the absolute end". */
export function sessionTtlSeconds(nowSec: number, expSec: number | undefined, idleSeconds: number): number {
  const idle = Math.max(0, Math.floor(idleSeconds));
  if (expSec === undefined || !Number.isFinite(expSec)) return idle;
  return Math.max(0, Math.min(idle, Math.floor(expSec - nowSec)));
}

/** True for requests the browser makes on its own (polling). They must never extend the idle window. */
export function isBackgroundRequest(header: string | undefined): boolean {
  return header === '1';
}

/** What the client needs to run its own idle timer in step with the server. */
export function sessionInfo(nowSec: number, expSec: number | undefined, idleSeconds: number) {
  return { idleSeconds: Math.floor(idleSeconds), expiresAt: expSec === undefined ? null : new Date(expSec * 1000).toISOString(), ttlSeconds: sessionTtlSeconds(nowSec, expSec, idleSeconds) };
}
