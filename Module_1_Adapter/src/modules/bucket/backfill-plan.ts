// Pure planning for the one-time import of the legacy creator tables into the registry.
// The CLI reads legacy rows, calls planBackfill, prints the report, and only writes with --apply.
import { slugify, uniqueSlug } from './parse.js';

export type LegacyYoutube = { id: string; channelId: string; displayName: string; slug: string; enabled: boolean; categoryIds: string[] };
export type LegacyInstagram = { id: string; username: string; displayName: string; slug: string; enabled: boolean; eligibility: 'pending' | 'approved' | 'rejected'; youtubeCreatorId: string | null; instagramId: string | null; categoryIds: string[] };

export type PlannedAccount = { platform: 'youtube' | 'instagram'; externalId: string; handle: string; legacyCreatorId: string | null; legacyInstagramCreatorId: string | null; pendingExternalId: boolean };
export type PlannedPerson = { slug: string; displayName: string; accounts: PlannedAccount[]; categoryIds: string[]; primaryCategoryId: string | null };
export type BackfillReport = { youtubeRead: number; instagramRead: number; skippedDisabled: number; skippedRejected: number; instagramLinkedToYoutube: number; instagramStandalone: number; instagramPendingId: number; duplicateLinkSplit: number; duplicateAccounts: number; people: number; accounts: number };

export function planBackfill(yt: LegacyYoutube[], ig: LegacyInstagram[], existingSlugs: Iterable<string> = []): { people: PlannedPerson[]; report: BackfillReport; warnings: string[] } {
  const slugs = new Set(existingSlugs);
  const warnings: string[] = [];
  const report: BackfillReport = { youtubeRead: yt.length, instagramRead: ig.length, skippedDisabled: 0, skippedRejected: 0, instagramLinkedToYoutube: 0, instagramStandalone: 0, instagramPendingId: 0, duplicateLinkSplit: 0, duplicateAccounts: 0, people: 0, accounts: 0 };
  const people: PlannedPerson[] = [];
  const byYoutubeLegacyId = new Map<string, PlannedPerson>();
  const seenAccounts = new Set<string>();

  const finish = (p: PlannedPerson) => { const u = [...new Set(p.categoryIds)]; p.categoryIds = u; p.primaryCategoryId = u.length === 1 ? u[0] : null; };

  for (const y of [...yt].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!y.enabled) { report.skippedDisabled++; continue; }
    const key = `youtube:${y.channelId}`;
    if (seenAccounts.has(key)) { report.duplicateAccounts++; warnings.push(`duplicate YouTube channel skipped: legacy id ${y.id}`); continue; }
    seenAccounts.add(key);
    const person: PlannedPerson = { slug: uniqueSlug(slugify(y.slug || y.displayName, y.channelId), slugs), displayName: y.displayName, accounts: [{ platform: 'youtube', externalId: y.channelId, handle: y.channelId, legacyCreatorId: y.id, legacyInstagramCreatorId: null, pendingExternalId: false }], categoryIds: [...y.categoryIds], primaryCategoryId: null };
    people.push(person); byYoutubeLegacyId.set(y.id, person);
  }

  for (const i of [...ig].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!i.enabled) { report.skippedDisabled++; continue; }
    if (i.eligibility === 'rejected') { report.skippedRejected++; continue; }
    const externalId = i.instagramId ?? `pending:${i.username}`;
    const pending = i.instagramId == null;
    const key = `instagram:${externalId}`;
    if (seenAccounts.has(key)) { report.duplicateAccounts++; warnings.push(`duplicate Instagram account skipped: legacy id ${i.id}`); continue; }
    const account: PlannedAccount = { platform: 'instagram', externalId, handle: i.username, legacyCreatorId: null, legacyInstagramCreatorId: i.id, pendingExternalId: pending };
    const host = i.youtubeCreatorId ? byYoutubeLegacyId.get(i.youtubeCreatorId) : undefined;
    if (host && !host.accounts.some(a => a.platform === 'instagram')) {
      seenAccounts.add(key);
      host.accounts.push(account); host.categoryIds.push(...i.categoryIds);
      report.instagramLinkedToYoutube++;
    } else {
      if (host) { report.duplicateLinkSplit++; warnings.push(`Instagram legacy ${i.id} points at a YouTube creator that already has Instagram; kept as its own person`); }
      seenAccounts.add(key);
      people.push({ slug: uniqueSlug(slugify(i.slug || i.displayName, i.username), slugs), displayName: i.displayName, accounts: [account], categoryIds: [...i.categoryIds], primaryCategoryId: null });
      report.instagramStandalone++;
    }
    if (pending) report.instagramPendingId++;
  }
  people.forEach(finish);
  report.people = people.length;
  report.accounts = people.reduce((n, p) => n + p.accounts.length, 0);
  return { people, report, warnings };
}
