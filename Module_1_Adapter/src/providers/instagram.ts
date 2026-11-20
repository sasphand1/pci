import { classifyProviderError, mapInstagram, type IgBody } from './map.js';
import type { AccountRef, FetchResult, Provider } from './types.js';

const API_VERSION = 'v27.0'; // same version the existing Instagram service uses
const MEDIA_LIMIT = 50;

export function makeInstagramProvider(env: NodeJS.ProcessEnv = process.env, now: () => Date = () => new Date(), fetchImpl: typeof fetch = fetch): Provider {
  return {
    platform: 'instagram',
    async fetch(accounts: AccountRef[]): Promise<FetchResult[]> {
      const token = env.INSTAGRAM_GRAPH_ACCESS_TOKEN, owner = env.INSTAGRAM_GRAPH_OWNER_ID;
      if (!token || !owner || !/^[0-9]+$/.test(owner)) return accounts.map(a => ({ accountId: a.id, outcome: 'error' as const, metrics: [], detail: 'not_configured' }));
      const out: FetchResult[] = [];
      let limited = false;
      // One at a time to stay inside the Graph API budget.
      for (const a of accounts) {
        if (limited) { out.push({ accountId: a.id, outcome: 'rate_limited', metrics: [], detail: 'skipped_after_rate_limit' }); continue; }
        const username = a.handle.toLowerCase();
        if (!/^[a-z0-9._]{1,30}$/.test(username)) { out.push({ accountId: a.id, outcome: 'error', metrics: [], detail: 'invalid_username' }); continue; }
        try {
          // Fixed host; the username is validated above and can never become a URL or host.
          const url = new URL(`https://graph.facebook.com/${API_VERSION}/${owner}`);
          url.searchParams.set('fields', `business_discovery.username(${username}){id,username,followers_count,media_count,media.limit(${MEDIA_LIMIT}){timestamp}}`);
          const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
          let body: IgBody | null = null;
          try { body = await res.json() as IgBody; } catch { body = null; }
          const mapped = mapInstagram(body, res.status, username, now().getTime(), MEDIA_LIMIT);
          if (mapped.outcome === 'rate_limited') limited = true;
          out.push({ accountId: a.id, ...mapped });
        } catch (e) {
          const c = classifyProviderError(e);
          out.push({ accountId: a.id, outcome: c.outcome, metrics: [], detail: c.detail === 'The operation was aborted due to timeout' ? 'timeout' : c.detail });
        }
      }
      return out;
    }
  };
}
