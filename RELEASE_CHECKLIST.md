# PCI release acceptance checks

- [ ] Existing PostgreSQL backup exists and restores on a staging database.
- [ ] Installer `--dry-run` reports all expected paths and no source mismatch.
- [ ] All Node/Next.js tests and production builds pass across Modules 1, 2, 3.
- [ ] Add 2 eligible accounts with same category and verify category-scoped order.
- [ ] Disable one account; next ranking query no longer includes it; re-enable and verify.
- [ ] Hide subscriber counts; account moves to directory-only unranked status.
- [ ] Approve two matching human YT+IG accounts and confirm all-rounder percentile calculation.
- [ ] Test separate YouTube 15-card and Instagram 15-card rows with actual snapshots; proper #n to #1 sequence.
- [ ] Test second category filter; tied counts share a dense rank.
- [ ] Verify no TikTok accounts/metrics are fabricated.
- [ ] Test permanent delete with **staging fixtures only** including linked Instagram, video statistics and category assignments; rollback with an intentionally restrictive FK.
- [ ] Reimport deleted account identity on staging without slug collision.
- [ ] Verify admin roles: only owner can permanently purge; editor can bulk assign categories.
- [ ] Check cache invalidation and public UI after edits.
- [ ] Confirm all-rounder wheel clearly labels the 25/25/50 relative policy and does not claim unique reach.
- [ ] Review production health, logs and rollback after deployment.
