# PCI Ingest — one ZIP, two phases

**Target repository:** `sasphand1/pci` (existing deployed system, not standalone).

This is a **file-scoped incremental update**, not a replacement checkout. It contains:

- `integration.patch`: minimal edits to seven existing Module 1 files.
- Eleven new files under `Module_1_Adapter/` (database migration, source contracts/adapters/routes, unit tests and documentation).
- `apply-update.ps1`: safeguards, patch check, exact file copy/stage, full local check, commit and push.

## Apply on Windows PowerShell

Copy `pci-ingest-two-phases.zip` to your existing PCI repository root and run:

```powershell
Expand-Archive -LiteralPath .\pci-ingest-two-phases.zip -DestinationPath .\pci-ingest-two-phases -Force
& .\pci-ingest-two-phases\apply-update.ps1
```

The script aborts if the current branch is not `main`, any of the exact affected existing files have local changes, any new destination file already exists, or the integration patch does not apply. It runs the full Module 1 check **before commit and push**; it leaves failures uncommitted for investigation.

**No production HTTP sources are enabled automatically.** The current ranking system remains unchanged until a shadow comparison justifies setting `PCI_INGEST_RANKING=true`.

## Operational acceptance

1. Confirm the new `/api/v1/admin/ingest/status` returns real source and stored-record counts.
2. Run an authenticated backfill with `{ "historyDays": 7, "videos": true }` to populate canonical observations without any new platform calls.
3. Compare the existing rank scope outputs against the new latest projection; only then consider enabling `PCI_INGEST_RANKING` in a controlled release.
4. Validate platform access rules before enabling public HTTP enrichment or a TikTok oEmbed source. No blocked-login circumvention is included.

## Known boundaries

- YouTube API: the existing scheduled collector is enhanced to save likes and comment counts from the *same* videos response.
- YouTube HTTP: pinned-comment extraction is a proven prototype; this update includes parsing, preview, and admin-submitted evidence storage. It does **not** claim an unattended approved YouTube comments scraper.
- Instagram: opt-in public OG avatar fallback is implemented but **not live-validated**; it fails safely when absent or blocked.
- TikTok: opt-in public oEmbed identity metadata is implemented; it does not provide follower/views/likes metrics.
- This package does not fabricate local-business or drama statistics, or replace the Fifi frontend's demonstration content. Domain-specific ingestion remains separate work.
- No live PostgreSQL/Hostinger deployment tests were possible in the patch construction environment; `apply-update.ps1` invokes the project's real build and tests before pushing.
