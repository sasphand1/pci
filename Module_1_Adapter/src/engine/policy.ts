import type { Metric, Platform } from './types.js';

export type ScopePolicy = { scope: string; policyVersion: string; metric: Metric; /** Platforms whose accounts count. */ platforms: Platform[]; /** Only people with an account on this platform are in the population. */ requirePlatform?: Platform; category?: string };

export const FRESHNESS_DAYS_DEFAULT = 7;
/** Which platforms can supply each metric. TikTok is disabled in v1 and never counted. */
export const METRIC_PLATFORMS: Record<Metric, Platform[]> = {
  followers: ['youtube', 'instagram'],
  views: ['youtube'],
  posts_30d: ['youtube', 'instagram']
};

export const FIXED_SCOPES = ['wheel.subscribed', 'wheel.viewed', 'wheel.active', 'youtube.subscribed', 'instagram.followers'] as const;

export function policyFor(scope: string): ScopePolicy {
  switch (scope) {
    case 'wheel.subscribed': return { scope, policyVersion: 'wheel.subscribed@v1', metric: 'followers', platforms: METRIC_PLATFORMS.followers };
    case 'wheel.viewed': return { scope, policyVersion: 'wheel.viewed@v1', metric: 'views', platforms: METRIC_PLATFORMS.views };
    case 'wheel.active': return { scope, policyVersion: 'wheel.active@v1', metric: 'posts_30d', platforms: METRIC_PLATFORMS.posts_30d };
    case 'youtube.subscribed': return { scope, policyVersion: 'youtube.subscribed@v1', metric: 'followers', platforms: ['youtube'], requirePlatform: 'youtube' };
    case 'instagram.followers': return { scope, policyVersion: 'instagram.followers@v1', metric: 'followers', platforms: ['instagram'], requirePlatform: 'instagram' };
  }
  const m = /^category\.([a-z0-9-]{2,60})$/.exec(scope);
  if (m) return { scope, policyVersion: 'category.subscribed@v1', metric: 'followers', platforms: METRIC_PLATFORMS.followers, category: m[1] };
  throw new Error(`Unknown scope: ${scope}`);
}
export const categoryScope = (slug: string) => `category.${slug}`;
