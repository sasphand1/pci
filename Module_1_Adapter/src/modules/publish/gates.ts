// Pure publication gates. A draft is published only if every gate passes.
// Large movements of individual people are deliberately NOT a gate.
import { inputHash, policyFor, type RankResult } from '../../engine/index.js';

export type GateName = 'policy_version' | 'non_negative_integers' | 'unique_people' | 'valid_references' | 'slots_gap_free' | 'rank_consistent' | 'coverage' | 'input_hash';
export type GateFailure = { gate: GateName; message: string };
export type GateOptions = { knownPersonIds: Set<string>; minCoverage: number; checkCoverage: boolean };

export function minCoverageFrom(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.PCI_MIN_COVERAGE);
  return env.PCI_MIN_COVERAGE !== undefined && Number.isFinite(n) && n >= 0 && n <= 1 ? n : 0.5;
}

export function runGates(r: RankResult, o: GateOptions): GateFailure[] {
  const out: GateFailure[] = [];
  const fail = (gate: GateName, message: string) => out.push({ gate, message });

  try { if (policyFor(r.scope).policyVersion !== r.policyVersion) fail('policy_version', `Expected ${policyFor(r.scope).policyVersion}, found ${r.policyVersion}`); }
  catch { fail('policy_version', `Unknown scope ${r.scope}`); }

  for (const e of r.entries) {
    const sum = e.breakdown.reduce((n, b) => n + b.value, 0);
    const ints = [e.value, ...e.breakdown.map(b => b.value)].every(v => Number.isSafeInteger(v) && v >= 0);
    if (!ints) { fail('non_negative_integers', `Person ${e.personId} has a value that is not a non-negative integer`); break; }
    if (sum !== e.value) { fail('non_negative_integers', `Person ${e.personId}: value ${e.value} does not equal the sum of its contributions ${sum}`); break; }
  }

  const seen = new Set<string>(); let dup = false;
  for (const id of [...r.entries.map(e => e.personId), ...r.unranked.map(u => u.personId)]) { if (seen.has(id)) dup = true; seen.add(id); }
  if (dup) fail('unique_people', 'A person appears more than once');

  const missing = [...seen].filter(id => !o.knownPersonIds.has(id));
  if (missing.length) fail('valid_references', `${missing.length} person(s) no longer exist`);

  if (r.entries.some((e, i) => e.slot !== i + 1)) fail('slots_gap_free', 'Slots are not 1..N without gaps');

  let rankOk = true;
  r.entries.forEach((e, i) => {
    if (i > 0 && e.value > r.entries[i - 1].value) rankOk = false;
    if (e.rank !== 1 + r.entries.filter(x => x.value > e.value).length) rankOk = false;
  });
  if (!rankOk) fail('rank_consistent', 'Ranks do not follow value order');

  if (o.checkCoverage && r.population > 0 && r.covered / r.population < o.minCoverage)
    fail('coverage', `Only ${r.covered} of ${r.population} people have fresh data (needs at least ${Math.round(o.minCoverage * 100)}%)`);

  if (inputHash(r.scope, r.policyVersion, r.entries, r.unranked) !== r.inputHash) fail('input_hash', 'The input hash does not reproduce from the stored data');
  return out;
}
