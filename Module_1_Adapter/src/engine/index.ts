import { aggregatePerson, type Aggregated } from './aggregate.js';
import { FRESHNESS_DAYS_DEFAULT, policyFor } from './policy.js';
import { inputHash } from './hash.js';
import { orderAggregated } from './order.js';
import { latestByKey } from './resolve.js';
import { assignSlots } from './slots.js';
import type { RankInput, RankResult, Unranked } from './types.js';

export * from './types.js';
export { policyFor, FIXED_SCOPES, METRIC_PLATFORMS, categoryScope, FRESHNESS_DAYS_DEFAULT } from './policy.js';
export { inputHash } from './hash.js';
export { removePerson } from './remove.js';

/** Rank one scope. Pure: same input, same output, whatever the order of the arrays. */
export function rankScope(scope: string, input: RankInput): RankResult {
  const policy = policyFor(scope);
  const nowMs = Date.parse(input.now);
  if (!Number.isFinite(nowMs)) throw new Error('Invalid now');
  const freshness = input.freshnessDays ?? FRESHNESS_DAYS_DEFAULT;
  const latest = latestByKey(input.observations, nowMs);

  // Layer 1: population
  const people = input.people.filter(p =>
    (!policy.requirePlatform || p.accounts.some(a => a.platform === policy.requirePlatform)) &&
    (!policy.category || p.categories.includes(policy.category)));

  const valued: Aggregated[] = [];
  const unranked: Unranked[] = [];
  let population = 0;
  for (const p of people) {
    const agg = aggregatePerson(p, policy, latest, nowMs, freshness); // layers 2-3
    if (agg.linked === 0) { unranked.push({ personId: p.id, reason: 'no_supported_account', linked: 0 }); continue; }
    population++;
    if (agg.counted === 0) unranked.push({ personId: p.id, reason: 'no_valid_value', linked: agg.linked }); // layer 4
    else valued.push(agg);
  }
  unranked.sort((a, b) => (a.personId < b.personId ? -1 : a.personId > b.personId ? 1 : 0));
  const entries = assignSlots(orderAggregated(valued)); // layers 5-6
  return { scope, policyVersion: policy.policyVersion, population, covered: entries.length, entries, unranked, inputHash: inputHash(scope, policy.policyVersion, entries, unranked) };
}

export function rankAll(scopes: string[], input: RankInput): RankResult[] { return scopes.map(s => rankScope(s, input)); }
