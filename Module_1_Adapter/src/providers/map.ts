import { safeAvatarUrl } from './avatar.js';
// Pure mapping from provider API payloads to results. No network, no config: unit-tested with fixtures.
import type { FetchResult, MetricValue } from './types.js';

const DAY = 86_400_000;
const FUTURE_TOLERANCE = 5 * 60_000;
export const RATE_LIMIT_INSTAGRAM_CODES = new Set([4, 17, 32, 613, 80004]);

export function toCount(v: unknown): number | null {
  if (typeof v === 'number') return Number.isSafeInteger(v) && v >= 0 ? v : null;
  if (typeof v === 'string' && /^\d{1,15}$/.test(v)) { const n = Number(v); return Number.isSafeInteger(n) ? n : null; }
  return null;
}

/** Items must be newest first. Counts items inside the window; `sawOlder` says the window is fully covered. */
export function windowCount(timestamps: string[], nowMs: number, days: number): { count: number; sawOlder: boolean } {
  let count = 0;
  for (const t of timestamps) {
    const ms = Date.parse(t);
    if (!Number.isFinite(ms)) continue;
    if (ms > nowMs + FUTURE_TOLERANCE) continue;
    if (nowMs - ms <= days * DAY) count++; else return { count, sawOlder: true };
  }
  return { count, sawOlder: false };
}

export type YtChannelLike = { id?: string; statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean; viewCount?: string } };

/** Channel statistics only. posts_30d is added separately so a failure there never loses these. */
export function mapYoutubeStatistics(ch: YtChannelLike | undefined): Pick<FetchResult, 'outcome' | 'metrics' | 'detail'> {
  if (!ch) return { outcome: 'not_found', metrics: [], detail: 'channel_not_returned' };
  const s = ch.statistics ?? {};
  const metrics: MetricValue[] = [];
  const notes: string[] = [];
  const views = toCount(s.viewCount);
  if (views !== null) metrics.push({ metric: 'views', value: views, accuracy: 'exact' }); else notes.push('views_missing');
  const hidden = s.hiddenSubscriberCount === true;
  const subs = hidden ? null : toCount(s.subscriberCount);
  // YouTube rounds subscriber counts to 3 significant figures.
  if (subs !== null) metrics.push({ metric: 'followers', value: subs, accuracy: 'rounded3' }); else notes.push(hidden ? 'followers_hidden' : 'followers_missing');
  if (!metrics.length) return { outcome: hidden ? 'hidden' : 'error', metrics, detail: notes.join(',') || 'no_statistics' };
  return { outcome: 'ok', metrics, detail: notes.length ? notes.join(',') : undefined };
}

export type IgBody = { business_discovery?: { id?: string; username?: string; followers_count?: unknown; profile_picture_url?: unknown; media?: { data?: Array<{ timestamp?: string }> } }; error?: { code?: number } };

export function mapInstagram(body: IgBody | null, httpStatus: number, username: string, nowMs: number, mediaLimit: number): Pick<FetchResult, 'outcome' | 'metrics' | 'detail' | 'resolvedExternalId' | 'avatarUrl'> {
  const code = body?.error?.code;
  if (code !== undefined || httpStatus >= 400) {
    if (code !== undefined && RATE_LIMIT_INSTAGRAM_CODES.has(code)) return { outcome: 'rate_limited', metrics: [], detail: `graph_code_${code}` };
    if (httpStatus >= 500 || httpStatus === 429) return { outcome: httpStatus === 429 ? 'rate_limited' : 'error', metrics: [], detail: `http_${httpStatus}` };
    // The Graph API uses the same error for missing, private and non-Business/Creator accounts.
    return { outcome: 'unsupported', metrics: [], detail: `graph_code_${code ?? httpStatus}` };
  }
  const r = body?.business_discovery;
  if (!r) return { outcome: 'unsupported', metrics: [], detail: 'no_business_discovery' };
  if (typeof r.username !== 'string' || r.username.toLowerCase() !== username.toLowerCase()) return { outcome: 'error', metrics: [], detail: 'username_mismatch' };
  const followers = toCount(r.followers_count);
  if (followers === null) return { outcome: 'unsupported', metrics: [], detail: 'followers_unavailable' };
  const metrics: MetricValue[] = [{ metric: 'followers', value: followers, accuracy: 'exact' }];
  let detail: string | undefined;
  const media = r.media?.data;
  if (Array.isArray(media)) {
    const { count, sawOlder } = windowCount(media.map(m => String(m.timestamp ?? '')), nowMs, 30);
    const capped = !sawOlder && media.length >= mediaLimit;
    metrics.push({ metric: 'posts_30d', value: count, accuracy: 'exact', ...(capped ? { capped: true } : {}) });
    if (capped) detail = 'posts_capped';
  } else detail = 'media_unavailable';
  const id = typeof r.id === 'string' && /^[0-9]+$/.test(r.id) ? r.id : undefined;
  return { outcome: 'ok', metrics, detail, resolvedExternalId: id, avatarUrl: safeAvatarUrl(r.profile_picture_url) ?? undefined };
}

/** Turns a thrown error into a per-account outcome. Messages from our clients are codes, never secrets. */
export function classifyProviderError(e: unknown): { outcome: 'rate_limited' | 'error'; detail: string } {
  const m = e instanceof Error ? e.message : String(e);
  if (/SOFT_QUOTA|quotaExceeded|rateLimitExceeded|userRateLimitExceeded|HTTP_429|HTTP_503/i.test(m)) return { outcome: 'rate_limited', detail: m.slice(0, 120) };
  if (/not configured|NOT_CONFIGURED/i.test(m)) return { outcome: 'error', detail: 'not_configured' };
  return { outcome: 'error', detail: m.slice(0, 120) };
}
