import type { YoutubeChannel, YoutubeClient } from '../modules/youtube/client.js';
import { pickAvatar } from './avatar.js';
import { classifyProviderError, mapYoutubeStatistics, windowCount } from './map.js';
import type { AccountRef, FetchResult, Provider } from './types.js';

const MAX_UPLOAD_PAGES = 4; // 200 videos; the cap is recorded when it is hit

type Client = Pick<YoutubeClient, 'channels' | 'uploadsPage'>;

async function postsLast30Days(client: Client, ch: YoutubeChannel, nowMs: number): Promise<{ value: number; capped: boolean }> {
  const playlist = ch.contentDetails?.relatedPlaylists?.uploads;
  if (!playlist) throw new Error('NO_UPLOADS_PLAYLIST');
  let count = 0, token: string | undefined, pages = 0;
  for (;;) {
    const page = await client.uploadsPage(playlist, token);
    pages++;
    const w = windowCount(page.published, nowMs, 30);
    count += w.count;
    if (w.sawOlder || !page.next) return { value: count, capped: false };
    if (pages >= MAX_UPLOAD_PAGES) return { value: count, capped: true };
    token = page.next;
  }
}

export function makeYoutubeProvider(client: Client, now: () => Date = () => new Date()): Provider {
  return {
    platform: 'youtube',
    async fetch(accounts: AccountRef[]): Promise<FetchResult[]> {
      const out: FetchResult[] = [];
      for (let i = 0; i < accounts.length; i += 50) {
        const group = accounts.slice(i, i + 50);
        let channels: YoutubeChannel[];
        try { channels = await client.channels(group.map(a => a.externalId)); }
        catch (e) { const c = classifyProviderError(e); for (const a of group) out.push({ accountId: a.id, outcome: c.outcome, metrics: [], detail: c.detail }); continue; }
        const byId = new Map(channels.map(c => [c.id, c]));
        for (const a of group) {
          const ch = byId.get(a.externalId);
          const base = mapYoutubeStatistics(ch);
          const result: FetchResult = { accountId: a.id, ...base, metrics: [...base.metrics] };
          if (ch && result.outcome === 'ok') {
            const avatar = pickAvatar(ch.snippet?.thumbnails); if (avatar) result.avatarUrl = avatar;
            // Channel statistics are already safe in `result`; a failure here only loses posts_30d.
            try { const p = await postsLast30Days(client, ch, now().getTime()); result.metrics.push({ metric: 'posts_30d', value: p.value, accuracy: 'exact', ...(p.capped ? { capped: true } : {}) }); if (p.capped) result.detail = [result.detail, 'posts_capped'].filter(Boolean).join(','); }
            catch (e) { result.detail = [result.detail, `posts_unavailable:${classifyProviderError(e).detail}`].filter(Boolean).join(','); }
          }
          out.push(result);
        }
      }
      return out;
    }
  };
}
