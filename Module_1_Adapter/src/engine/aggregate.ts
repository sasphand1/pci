import type { Contribution, PersonIn, Observation } from './types.js';
import type { ScopePolicy } from './policy.js';
import { resolveValue } from './resolve.js';

export type Aggregated = { personId: string; createdAt: string; value: number; maxSingle: number; counted: number; linked: number; breakdown: Contribution[] };

export function aggregatePerson(person: PersonIn, policy: ScopePolicy, latest: Map<string, Observation>, nowMs: number, freshnessDays: number): Aggregated {
  const linkedAccounts = person.accounts.filter(a => policy.platforms.includes(a.platform));
  const breakdown: Contribution[] = [];
  let value = 0, maxSingle = 0;
  for (const a of linkedAccounts) {
    const o = resolveValue(latest, a.id, policy.metric, nowMs, freshnessDays);
    if (!o) continue;
    breakdown.push({ accountId: a.id, platform: a.platform, value: o.value, observedAt: o.observedAt, accuracy: o.accuracy });
    value += o.value; if (o.value > maxSingle) maxSingle = o.value;
  }
  if (!Number.isSafeInteger(value)) throw new Error('Aggregate exceeds safe integer range');
  breakdown.sort((x, y) => (x.accountId < y.accountId ? -1 : x.accountId > y.accountId ? 1 : 0));
  return { personId: person.id, createdAt: person.createdAt, value, maxSingle, counted: breakdown.length, linked: linkedAccounts.length, breakdown };
}
