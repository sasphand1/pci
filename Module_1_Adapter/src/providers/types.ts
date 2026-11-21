export type Platform = 'youtube' | 'instagram' | 'tiktok';
export type Outcome = 'ok' | 'hidden' | 'not_found' | 'private' | 'rate_limited' | 'unsupported' | 'error';
export type MetricName = 'followers' | 'views' | 'posts_30d';
export type AccountRef = { id: string; platform: Platform; externalId: string; handle: string };
export type MetricValue = { metric: MetricName; value: number; accuracy: 'exact' | 'rounded3'; /** posts_30d only: the page cap was reached, so the true count may be higher */ capped?: boolean };
export type FetchResult = { accountId: string; outcome: Outcome; metrics: MetricValue[]; detail?: string; /** Instagram: numeric id learned while fetching (replaces a `pending:` placeholder) */ resolvedExternalId?: string; /** YouTube: channel picture (checked against known image hosts before it is stored) */ avatarUrl?: string };

/** fetch() returns one result per account. A failure of one account never blocks the others. */
export interface Provider { platform: Platform; fetch(accounts: AccountRef[]): Promise<FetchResult[]> }
export const MAX_ATTEMPTS = 3;
