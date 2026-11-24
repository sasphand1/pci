import { safeAvatarUrl } from '../../providers/avatar.js';
import { AVATAR_MAX_BYTES } from './avatar-cache-rules.js';

/** Downloads one picture from a trusted image host. Never follows redirects, caps size, never logs the URL. */
export async function downloadAvatar(url: string, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; status: number; body: Uint8Array | null }> {
  if (!safeAvatarUrl(url)) return { ok: false, status: 0, body: null };
  try {
    const res = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { Accept: 'image/*' } });
    if (!res.ok || !res.body) return { ok: false, status: res.status, body: null };
    const reader = res.body.getReader(); const parts: Uint8Array[] = []; let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > AVATAR_MAX_BYTES) { await reader.cancel(); return { ok: false, status: 413, body: null }; }
      parts.push(value);
    }
    const body = new Uint8Array(total); let o = 0; for (const p of parts) { body.set(p, o); o += p.length; }
    return { ok: true, status: res.status, body };
  } catch { return { ok: false, status: 0, body: null }; }
}
