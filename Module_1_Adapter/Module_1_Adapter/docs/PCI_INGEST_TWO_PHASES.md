# PCI Ingest — two-phase production rollout

Based on `sasphand1/pci` main SHA `416046e24a62f1d9f51d4e024791387b85879295`, reviewed 2026-11-23.
This package contains **new source files and a small integration.patch**. It does not overwrite a teammate's modified repository files.

## Phase 1 — Central source-of-truth foundation (included)

- Additive PostgreSQL migration `103_ingest.sql` and Hostinger startup schema bootstrap.
- Raw field observations, latest validated values, shared content, pinned-comment evidence, source configuration and job schema.
- Source provenance and API-first reconciliation; absent values never silently become zero.
- **Compatibility bridge** mirrors existing API refresh observations, historical API values and YouTube video samples into Ingest (no extra YouTube requests). The old ranking engine continues to use its existing observations unchanged.
- Admin status, policy and idempotent backfill APIs.

## Phase 2 — Bounded public enrichment (included, selectively enabled)

- YouTube verified creator-pinned-comment **parser and authenticated preview endpoint**, using supplied legitimate source JSON, without triggering undocumented continuation requests. No unattended web collector is enabled.
- Instagram public `og:image` enrichment adapter with strict profile identity and trusted-CDN checks; defaults disabled. Requires both `PCI_INSTAGRAM_HTTP_AVATARS=true` and the admin-enabled `instagram.http` source, after confirming source permissions.
- TikTok public oEmbed lookup and storage for video identity, title, link and thumbnail (no implied engagement metrics). Requires enabling `tiktok.http` via owner admin API. No special research approval or creator OAuth.
- Fail-closed Redis-based per-request budgets for on-demand HTTP jobs. No captcha bypass, proxies, login cookies or hidden tokens.

### Existing backend route integration

All endpoints under `/api/v1/admin/ingest` require existing PCI admin session; mutations require Owner/Editor (source switches Owner only):

| Method | Endpoint | Function |
|---|---|---|
| GET | `/status` | Source status and actual stored-record counts |
| GET | `/policies` | Refresh hints and disabled HTTP defaults |
| POST | `/backfill` | Mirror a completed `refreshRunId`, `historyDays` (1–7), and/or recent video catalogue; no platform network |
| PATCH | `/sources/:id` | Owner enables/disables an HTTP source |
| POST | `/instagram/avatar/:accountId` | Opt-in, HTTPS-only avatar attempt for missing pictures |
| POST | `/tiktok/embed` | Key-free public oEmbed metadata for a known video URL |
| POST | `/youtube/pinned-preview` | Parse diagnostic comment JSON with no persistence |
| POST | `/youtube/pinned-import` | Save creator-pinned evidence as **submitted/unverified** after account ownership checks |

Example backfill request (admin cookie and CSRF protection as applicable to the existing admin stack):
`{"videos":true}`

### Data and operational decisions

- **Only the verified latest projection** should feed new consumers. `ingest_observations` stores provenance/history.
- API sources take precedence over newer HTTP readings within the freshness window.
- Pinned comments are never substituted by top comments. `null` means not verified.
- Stage-2 modules (comments intelligence, creator trends, Fifi page widgets) need separate published-data contracts; raw observations should not be exposed directly to the public site.
- The current Fifi local/business/dramas/AI sample panels do **not** automatically become factual because social ingestion has been added. Their feeds require separate verification.
- HTTP public observability is not evidence of unrestricted permission to scrape. Enable a source only after its automated use is confirmed compliant.

### Deployment instructions

1. On a clean PCI checkout, confirm repository's `main` commit and save uncommitted changes.
2. Apply the ZIP with the provided PowerShell commands. `git apply --check integration.patch` must succeed before any source is copied.
3. Run `npm run migrate` for Module 1 (or allow startup schema bootstrap), and run the normal Module 1 tests/build on a machine with installed node_modules and an integration-test database.
4. Verify `/api/v1/admin/ingest/status`, then try `/backfill` for a completed refresh and `videos=true`.
5. Enable HTTP sources only after validated access and source-policy review; defaults are disabled.
6. Migrate consumers toward Ingest in independent releases. Do not turn off legacy collection during the compatibility period.

### Verification status

The enclosed isolated logic tests cover API precedence, missing/invalid counts, pinned comments and public avatar metadata parsing. The package **cannot be certified against the live Hostinger PostgreSQL instance or the entire repository build here**, because the full repository and production dependencies were not available in this execution container. No live Instagram/TikTok website extraction was performed.

### Ranking cutover

Cutover is done (Hub update 1). Rankings read `ingest_latest` by default, and every other reader (public site, creator profiles, analytics, admin overview, coverage checks) reads the `hub_account_metrics` view. Every write to the old `metric_observations` table is copied into the hub by a database trigger in the same transaction, and the full old history was copied once (`hub_meta.legacy_history_v1`). `PCI_INGEST_RANKING=false` is an emergency rollback for rankings only and logs a warning at startup.

YouTube video sampling now preserves per-video description, views, likes and comment totals directly from the existing `videos.list` response. It consumes **no extra YouTube quota** beyond the existing collection.
