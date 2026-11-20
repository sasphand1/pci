import { inputHash } from './hash.js';
import type { RankResult } from './types.js';

/** Removes one person from a finished ranking without touching anybody else's value.
 * Slots are renumbered 1..N, ranks recomputed (competition ranking), counts and the hash updated.
 * This is how a hard delete updates every live ranking: other people never move because of data aging. */
export function removePerson(result: RankResult, personId: string): RankResult {
  const kept = result.entries.filter(e => e.personId !== personId);
  const wasRanked = kept.length !== result.entries.length;
  const unrankedHit = result.unranked.find(u => u.personId === personId);
  const unranked = result.unranked.filter(u => u.personId !== personId);
  let rank = 1;
  const entries = kept.map((e, i) => {
    if (i > 0 && e.value !== kept[i - 1].value) rank = i + 1;
    return { ...e, slot: i + 1, rank };
  });
  const countedInPopulation = wasRanked || (unrankedHit !== undefined && unrankedHit.reason === 'no_valid_value');
  return {
    ...result,
    entries, unranked,
    population: result.population - (countedInPopulation ? 1 : 0),
    covered: entries.length,
    inputHash: inputHash(result.scope, result.policyVersion, entries, unranked)
  };
}
