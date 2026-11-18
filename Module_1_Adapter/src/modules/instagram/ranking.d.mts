/** Types for the existing JavaScript Instagram ranking engine.
 * This file adds TypeScript declarations only: no change in ranking logic.
 */
export const INSTAGRAM_METRICS: ReadonlyArray<'followers' | 'posts'>;

export type InstagramRankingRecord = {
  username: string;
  followersCount: string | null;
  mediaCount: string | null;
  fetchedAt?: string | null;
  categories: Array<{ slug: string; [key: string]: unknown }>;
  [key: string]: unknown;
};

export function rankInstagram<T extends InstagramRankingRecord>(
  rows: T[],
  metric?: 'followers' | 'posts'
): Array<T & { rank: number | null; rankMetric: string }>;
