import type { AccountRef, FetchResult, Provider } from './types.js';
/** TikTok is out of scope for v1. It exists so the interface is complete; nothing is wired to it. */
export const tiktokProvider: Provider = {
  platform: 'tiktok',
  async fetch(accounts: AccountRef[]): Promise<FetchResult[]> {
    return accounts.map(a => ({ accountId: a.id, outcome: 'unsupported' as const, metrics: [], detail: 'tiktok_not_enabled' }));
  }
};
