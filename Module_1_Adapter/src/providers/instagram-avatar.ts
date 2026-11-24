import { inspectProfileAvatar } from './avatar.js';
import { RATE_LIMIT_INSTAGRAM_CODES } from './map.js';

/** Uses the same authorized Business Discovery owner as the normal Meta provider.
 * Returns reason codes, never secrets or image URLs in diagnostic messages. */
export type GraphAvatarProbe = {
  status: 'ok' | 'missing' | 'rejected' | 'token_invalid' | 'rate_limited' |
    'unsupported' | 'identity_mismatch' | 'unavailable' | 'not_configured';
  url?: string;
};

export async function fetchGraphInstagramAvatar(
  handle: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<GraphAvatarProbe> {
  const token = env.INSTAGRAM_GRAPH_ACCESS_TOKEN;
  const owner = env.INSTAGRAM_GRAPH_OWNER_ID;
  if (!token || !owner || !/^\d+$/.test(owner)) return { status: 'not_configured' };
  if (!/^[A-Za-z0-9._]{1,30}$/.test(handle)) return { status: 'unsupported' };
  try {
    const url = new URL(`https://graph.facebook.com/v27.0/${owner}`);
    url.searchParams.set('fields', `business_discovery.username(${handle.toLowerCase()}){username,profile_picture_url}`);
    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    type MetaAvatarBody = {
      error?: { code?: number };
      business_discovery?: { username?: unknown; profile_picture_url?: unknown };
    };
    let body: MetaAvatarBody | null;
    try { body = await response.json() as MetaAvatarBody | null; } catch { return { status: 'unavailable' }; }
    const code = body?.error?.code;
    if (code === 190) return { status: 'token_invalid' };
    if (code !== undefined && RATE_LIMIT_INSTAGRAM_CODES.has(code)) return { status: 'rate_limited' };
    if (response.status === 429) return { status: 'rate_limited' };
    if (response.status >= 500) return { status: 'unavailable' };
    if (!response.ok || !body?.business_discovery) return { status: 'unsupported' };
    const profile = body.business_discovery;
    if (typeof profile.username !== 'string' || profile.username.toLowerCase() !== handle.toLowerCase())
      return { status: 'identity_mismatch' };
    const picture = inspectProfileAvatar(profile.profile_picture_url);
    if (picture.avatarUrl) return { status: 'ok', url: picture.avatarUrl };
    return { status: picture.issue === 'avatar_rejected' ? 'rejected' : 'missing' };
  } catch { return { status: 'unavailable' }; }
}
