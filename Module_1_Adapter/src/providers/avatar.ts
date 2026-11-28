// Restrict public profile pictures to trusted YouTube and Meta image CDN hosts.
const HOSTS = new Set(['yt3.ggpht.com', 'yt3.googleusercontent.com', 'i.ytimg.com', 'img.youtube.com']);
const META_CDN_SUFFIXES = ['.cdninstagram.com', '.fbcdn.net'];
const TIKTOK_CDN_SUFFIXES = ['.tiktokcdn.com', '.tiktokcdn-us.com', '.tiktokcdn-eu.com'];
const isTrustedImageHost = (host: string): boolean => HOSTS.has(host) || [...META_CDN_SUFFIXES, ...TIKTOK_CDN_SUFFIXES].some(suffix => host.endsWith(suffix));

export function safeAvatarUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    const isYoutube = HOSTS.has(u.hostname);
    const maxLength = isYoutube ? 500 : 2048;
    return url.length <= maxLength && u.protocol === 'https:' && isTrustedImageHost(u.hostname) && !u.username && !u.password && !u.port ? u.toString() : null;
  } catch { return null; }
}

/** Shared avatar intake result for platform adapters. Never log the returned CDN URL:
 * signed image links can contain credentials and may expire. A new provider
 * (e.g. TikTok) must explicitly extend the host policy before enabling images. */
export function inspectProfileAvatar(source: unknown): { avatarUrl?: string; issue?: 'avatar_missing' | 'avatar_rejected' } {
  if (source === undefined || source === null || source === '') return { issue: 'avatar_missing' };
  const avatarUrl = safeAvatarUrl(source);
  return avatarUrl ? { avatarUrl } : { issue: 'avatar_rejected' };
}

/** Prefers a medium picture (about 240 px) and falls back to the others. */
export function pickAvatar(thumbs: Record<string, { url?: string }> | undefined): string | null {
  if (!thumbs) return null;
  for (const k of ['medium', 'high', 'default']) { const v = safeAvatarUrl(thumbs[k]?.url); if (v) return v; }
  return null;
}
