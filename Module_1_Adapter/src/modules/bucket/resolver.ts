// Turns a parsed handle/username into a stable provider id. Network lives here and
// nowhere else in the bucket, so the rest is testable with a fake Resolver.
import { YoutubeClient } from '../youtube/client.js';
import { fetchInstagramProfile } from '../instagram/service.js';
import type { Parsed, Platform } from './parse.js';
import type { ResolveResult } from './classify.js';

export interface Resolver { resolve(platform: Platform, parsed: Extract<Parsed, { ok: true }>): Promise<ResolveResult> }

export function makeResolver(): Resolver {
  const yt = new YoutubeClient();
  return {
    async resolve(platform, parsed) {
      try {
        if (platform === 'youtube') {
          const ch = parsed.kind === 'channel_id'
            ? (await yt.channels([parsed.value]))[0] ?? null
            : await yt.channelByHandle(parsed.value);
          if (!ch || !/^UC[A-Za-z0-9_-]{22}$/.test(ch.id)) return { ok: false, reason: 'not_found' };
          const custom = ch.snippet?.customUrl;
          return { ok: true, externalId: ch.id, handle: custom ?? (parsed.kind === 'handle' ? `@${parsed.value}` : ch.id), displayName: ch.snippet?.title };
        }
        const p = await fetchInstagramProfile(parsed.value);
        if (!p.id || !/^[0-9]+$/.test(p.id)) return { ok: false, reason: 'unsupported_account_type' };
        return { ok: true, externalId: p.id, handle: parsed.value };
      } catch (e) {
        const m = e instanceof Error ? e.message : '';
        // The Graph API gives one error for "missing", "private" and "not a professional account".
        if (m.startsWith('INSTAGRAM_GRAPH_ERROR_')) return { ok: false, reason: 'unsupported_account_type' };
        return { ok: false, reason: 'resolve_error' };
      }
    }
  };
}

/** Runs `fn` over items with at most `limit` in flight, preserving order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  }));
  return out;
}
