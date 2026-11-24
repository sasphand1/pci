/** Pure rules for the avatar cache: what may be stored, and how the stored copy is addressed. */
export const AVATAR_MAX_BYTES = 400_000;
export const AVATAR_RETRY_HOURS_OK = 6;
export const AVATAR_RETRY_HOURS_FAILED = 24;
export type ImageKind = { contentType: 'image/jpeg' | 'image/png' | 'image/webp' };

/** Decides by the file's own first bytes, never by what the server claims. */
export function sniffImage(b: Uint8Array): ImageKind | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { contentType: 'image/jpeg' };
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { contentType: 'image/png' };
  if (b.length >= 12 && String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP')
    return { contentType: 'image/webp' };
  return null;
}

/** Public address of a cached picture; the version changes whenever the stored copy changes. */
export function cachedAvatarUrl(base: string | undefined, accountId: string, fetchedAt: string | Date): string | null {
  if (!base || !/^https:\/\/[^/\s]+$/.test(base.replace(/\/$/, ''))) return null;
  const t = new Date(fetchedAt).getTime();
  if (!Number.isFinite(t) || !/^[0-9a-f-]{36}$/i.test(accountId)) return null;
  return `${base.replace(/\/$/, '')}/api/v1/public/avatars/${accountId}?v=${Math.floor(t / 1000)}`;
}

export function avatarRetryDue(lastAttemptAt: string | Date | null, lastResult: string | null, nowMs: number): boolean {
  if (!lastAttemptAt) return true;
  const t = new Date(lastAttemptAt).getTime();
  if (!Number.isFinite(t) || t > nowMs) return true;
  const hours = lastResult === 'ok' ? AVATAR_RETRY_HOURS_OK : AVATAR_RETRY_HOURS_FAILED;
  return nowMs - t >= hours * 3_600_000;
}

/** Hard ceiling for all stored pictures together (about 100 times the current need). */
export const AVATAR_CACHE_MAX_TOTAL_BYTES = 50_000_000;
export const cacheHasRoom = (totalBytes: number, incoming: number) => totalBytes + incoming <= AVATAR_CACHE_MAX_TOTAL_BYTES;

/** True when a run clearly shows this server cannot fetch pictures (blocked), not that single links expired. */
export function looksBlocked(results: string[]): boolean {
  return results.length >= 3 && results.every(r => r === 'http_403' || r === 'http_401' || r === 'http_429' || r === 'http_0');
}
