// Pure ranking core. This folder must never import the database, network, cache or config.
export type Platform = 'youtube' | 'instagram' | 'tiktok';
export type Metric = 'followers' | 'views' | 'posts_30d' | 'average_views' | 'average_likes' | 'average_comments' | 'average_shares';
export type Accuracy = 'exact' | 'rounded3';

export type AccountIn = { id: string; platform: Platform };
export type PersonIn = { id: string; createdAt: string; accounts: AccountIn[]; categories: string[] };
export type Observation = { accountId: string; metric: Metric; value: number; observedAt: string; accuracy: Accuracy };

export type RankInput = {
  /** The clock for freshness. Always passed in so a run is reproducible. */
  now: string;
  people: PersonIn[];
  observations: Observation[];
  /** Observations older than this are treated as missing. Default 7. */
  freshnessDays?: number;
};

export type Contribution = { accountId: string; platform: Platform; value: number; observedAt: string; accuracy: Accuracy };
export type Entry = { slot: number; rank: number; personId: string; value: number; counted: number; linked: number; breakdown: Contribution[] };
export type UnrankedReason = 'no_valid_value' | 'no_supported_account';
export type Unranked = { personId: string; reason: UnrankedReason; linked: number };

export type RankResult = {
  scope: string;
  policyVersion: string;
  /** People who have at least one account that can supply this scope's metric. */
  population: number;
  /** People with a valid value (== entries.length). */
  covered: number;
  entries: Entry[];
  unranked: Unranked[];
  inputHash: string;
};
