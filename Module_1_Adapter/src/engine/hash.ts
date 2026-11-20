import { createHash } from 'node:crypto';
import type { Entry, Unranked } from './types.js';

/** Canonical hash of everything a ranking was computed from: the policy, who was in, each person's
 * contributing observations and who was left out. Independent of input order and of slot numbering,
 * and recomputable from a stored ranking (slots + breakdown + unranked list). */
export function inputHash(scope: string, policyVersion: string, entries: Entry[], unranked: Unranked[]): string {
  const people = [
    ...entries.map(e => ['v', e.personId, e.linked, e.breakdown.map(b => [b.accountId, b.value, b.observedAt])]),
    ...unranked.map(u => ['u', u.personId, u.linked, u.reason])
  ].sort((a, b) => (String(a[1]) < String(b[1]) ? -1 : String(a[1]) > String(b[1]) ? 1 : 0));
  return createHash('sha256').update(JSON.stringify([scope, policyVersion, people])).digest('hex');
}
