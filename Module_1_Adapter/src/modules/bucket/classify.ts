// Pure classification of a batch of requested accounts. The service layer feeds it
// parsed input, provider resolutions and the current bucket state; it returns a status
// per row and, for addable rows, exactly what to insert. No I/O here.
import { normalizeName, parseAccountInput, slugify, uniqueSlug, type BulkRow, type Platform } from './parse.js';

export type ResolveResult =
  | { ok: true; externalId: string; handle: string; displayName?: string }
  | { ok: false; reason: 'not_found' | 'unsupported_account_type' | 'resolve_error' };

export type RowStatus =
  | 'resolved' | 'invalid_format' | 'not_found' | 'unsupported_account_type' | 'resolve_error'
  | 'duplicate_in_bucket' | 'duplicate_in_batch' | 'unknown_niche' | 'person_already_has_platform';

export type PersonTarget =
  | { kind: 'existing'; personId: string }
  | { kind: 'batch'; index: number }
  | { kind: 'new'; displayName: string; slug: string };

export type RowResult = {
  index: number; line: number; input: string; status: RowStatus; addable: boolean; hint?: string;
  platform: Platform; externalId?: string; handle?: string; person?: string; niche?: string; target?: PersonTarget;
};

export type ClassifyContext = {
  platform: Platform;
  /** resolutions keyed by row index (only for rows whose format parsed) */
  resolutions: Map<number, ResolveResult>;
  /** `${platform}:${externalId}` for every account already in the bucket */
  existingAccounts: Set<string>;
  /** existing people by exact normalized display name and by slug */
  peopleByName: Map<string, { id: string; platforms: Set<Platform> }>;
  peopleBySlug: Map<string, { id: string; platforms: Set<Platform> }>;
  takenSlugs: Set<string>;
  categorySlugs: Set<string>;
};

const RESOLVE_HINTS: Record<string, string> = {
  not_found: 'No such account was found',
  unsupported_account_type: 'Not found, private, or not a public Business/Creator account',
  resolve_error: 'The lookup failed. Try again'
};

export function classifyBatch(rows: BulkRow[], ctx: ClassifyContext): RowResult[] {
  const out: RowResult[] = [];
  const seen = new Set<string>();
  const batchPeople = new Map<string, { target: PersonTarget; platforms: Set<Platform> }>();
  const slugs = new Set(ctx.takenSlugs);

  for (const row of rows) {
    const base: RowResult = { index: row.index, line: row.line, input: row.raw, status: 'resolved', addable: false, platform: ctx.platform, person: row.person, niche: row.niche };
    const fail = (status: RowStatus, hint?: string): RowResult => ({ ...base, status, addable: false, hint });

    const parsed = parseAccountInput(ctx.platform, row.raw);
    if (!parsed.ok) { out.push(fail('invalid_format', parsed.hint)); continue; }

    const res = ctx.resolutions.get(row.index);
    if (!res) { out.push(fail('resolve_error', 'Could not be checked, try again')); continue; }
    if (!res.ok) { out.push(fail(res.reason, RESOLVE_HINTS[res.reason])); continue; }

    const key = `${ctx.platform}:${res.externalId}`;
    const withIds = { ...base, externalId: res.externalId, handle: res.handle };
    if (ctx.existingAccounts.has(key)) { out.push({ ...withIds, status: 'duplicate_in_bucket', addable: false }); continue; }
    if (seen.has(key)) { out.push({ ...withIds, status: 'duplicate_in_batch', addable: false }); continue; }

    if (row.niche && !ctx.categorySlugs.has(row.niche)) { out.push({ ...withIds, status: 'unknown_niche', addable: false, hint: `No category "${row.niche}"` }); continue; }

    // Linking to an existing person happens ONLY when the admin typed a person name that matches
    // exactly (after normalisation). Never fuzzy, never from the provider's display name.
    let target: PersonTarget;
    const typed = row.person?.trim();
    if (typed) {
      const norm = normalizeName(typed);
      const prior = batchPeople.get(norm);
      const existing = ctx.peopleByName.get(norm) ?? ctx.peopleBySlug.get(slugify(typed, ''));
      if (prior) {
        if (prior.platforms.has(ctx.platform)) { out.push({ ...withIds, status: 'person_already_has_platform', addable: false, hint: `${typed} already has a ${ctx.platform} account in this batch` }); continue; }
        prior.platforms.add(ctx.platform);
        target = prior.target;
      } else if (existing) {
        if (existing.platforms.has(ctx.platform)) { out.push({ ...withIds, status: 'person_already_has_platform', addable: false, hint: `${typed} already has a ${ctx.platform} account` }); continue; }
        target = { kind: 'existing', personId: existing.id };
        batchPeople.set(norm, { target, platforms: new Set([...existing.platforms, ctx.platform]) });
      } else {
        target = { kind: 'new', displayName: typed, slug: uniqueSlug(slugify(typed, res.handle), slugs) };
        batchPeople.set(norm, { target: { kind: 'batch', index: row.index }, platforms: new Set([ctx.platform]) });
      }
    } else {
      const name = (res.displayName?.trim() || res.handle);
      target = { kind: 'new', displayName: name, slug: uniqueSlug(slugify(name, res.handle), slugs) };
      // Not registered in batchPeople on purpose: untyped rows never auto-link.
    }
    seen.add(key);
    out.push({ ...withIds, status: 'resolved', addable: true, target });
  }
  return out;
}

export function summarizeBatch(rows: RowResult[]) {
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return { total: rows.length, addable: rows.filter(r => r.addable).length, counts };
}
