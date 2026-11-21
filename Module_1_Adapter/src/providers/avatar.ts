// Profile pictures are shown on the public site, so only well-known YouTube image hosts are accepted.
const HOSTS = new Set(['yt3.ggpht.com', 'yt3.googleusercontent.com', 'i.ytimg.com', 'img.youtube.com']);

export function safeAvatarUrl(url: unknown): string | null {
  if (typeof url !== 'string' || url.length > 500) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && HOSTS.has(u.hostname) && !u.username && !u.password ? u.toString() : null;
  } catch { return null; }
}

/** Prefers a medium picture (about 240 px) and falls back to the others. */
export function pickAvatar(thumbs: Record<string, { url?: string }> | undefined): string | null {
  if (!thumbs) return null;
  for (const k of ['medium', 'high', 'default']) { const v = safeAvatarUrl(thumbs[k]?.url); if (v) return v; }
  return null;
}
