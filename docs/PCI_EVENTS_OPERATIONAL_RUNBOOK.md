# PCI Events — Operational Data + Browser Fallback Repair

**Deployment target:** Existing Pakistan Creator Index monorepo on Hostinger. This package does not deploy another server or alter Satellite.

## Why the Event map was empty

The previous implementation only published records after a source was enabled, fetched, geolocated and owner-approved. The automatic feed catalogs were just presets and were not preconfigured. Separately, MapLibre's CDN can be blocked, leaving the visual fallback but no real events to show. A site can appear operational and still have zero publishable events.

## What the complete repair does

1. **Immediate real, dated starter notices.** The `/api/events` Next.js route merges approved backend events with three factual event notices checked on **22 November 2026** against primary official event/venue sources. Notices include the organizer's source URL, an independently documented venue coordinate, unknown ticket prices, and explicit dates. No fake event is inserted. The notices appear without requiring a live backend, admin approval or map CDN, and expire automatically after their real date windows.
2. **Feeds remain active when configured.** Integrates four existing documented free provider presets and their Admin test/install endpoints, RSS/ICS/JSON parser changes, attribution and source counters. Presets are **disabled** until the owner confirms provider terms and content. No promise of Pakistan coverage from a global feed is made.
3. **Owner verified-event editor.** Adds `/api/v1/admin/events/editorial` endpoints and an Admin form for individually verified organizer announcements, with required HTTPS primary-source URL, future start/end dates, actual venue, city-matched coordinates, owner confirmation, audit log, and reversible publication. No HTML page is treated as a JSON feed; editorial events use their own PostgreSQL table and migration `098_editorial_events.sql`.
4. **Graceful public fallback and precise status.** If the backend is missing or unavailable, curated notices still appear via `/api/events`. The API reports `backend_status` instead of silently disguising failures; if both the feed and curated notices are empty/unavailable, it returns HTTP 503. The map's static preview supports verified markers, accurate venue navigation via Waze, and event cards even when MapLibre tiles cannot load.
5. **No unrelated changes.** The public header, Satellite APIs and admin shell are untouched.

### Evidence for the three starter notices

These are *dated factual announcements*, not an automatically updating nationwide event feed. Recheck primary sources for any cancellation/reschedule before attending. No ticket fees or specific start times were inferred.

| City | Event and date | Primary event evidence | Venue coordinate evidence |
|---|---|---|---|
| Islamabad | IAPEX27, 15–17 January 2027 | https://www.iapex.pk/visit/faqs | Pakistan-China Friendship Centre, GeoNames/OSM displayed at https://mapcarta.com/35534338 — 33.69726, 73.08298 |
| Lahore | 40th Lahore International Book Fair, 20–24 January 2027 | https://libftrust.com/about-us/about-the-event/ | TDAP venue directions: https://wexnet.tdap.gov.pk/how-to-reach-expo-center/ — 31.464, 74.259 |
| Karachi | 21st Karachi International Book Fair, 17–21 December 2026 | TDAP booking schedule: https://tdap.gov.pk/wp-content/uploads/2025/07/Booking-Schedule-of-KEC_22_July.pdf | Karachi Expo Centre near 24.90139, 67.076083: https://en.wikipedia.org/wiki/Karachi_Expo_Center |

Catalog is a launch safety net. For ongoing coverage, add compatible organizer feeds and owner-verified editorial announcements. Catalog events are factual announcements captured on 2026-11-22, and may change. Their `source_name` labels carry the checking date.

## Install on Windows PowerShell

Download the single ZIP to the Downloads folder, then:

```powershell
cd C:\Users\sasph\Documents\PCI_Clean
$zip = "$env:USERPROFILE\Downloads\PCI_EVENTS_OPERATIONAL_REPAIR.zip"
$dir = "$env:USERPROFILE\Downloads\PCI_EVENTS_OPERATIONAL_REPAIR"
if (!(Test-Path $zip)) { throw "Download ZIP to Downloads first: $zip" }
Expand-Archive $zip -DestinationPath $dir -Force
node "$dir\APPLY_PCI_EVENTS_OPERATIONAL.mjs" "$PWD"
if ($LASTEXITCODE -ne 0) { throw "PCI Events update did not apply" }
```

The installer preflights source anchors, refuses unexpected conflicts, backs up modified files in `.pci-events-operational-backups/`, and is safe to rerun. It supports either a repo without the earlier feed-catalog ZIP or a repo with that catalog already applied.

## Test before pushing

```powershell
node --test Module_1_Adapter/tests/events*.test.mjs Module_1_Adapter/tests/pci-integration-contract.test.mjs
if ($LASTEXITCODE -ne 0) { throw "Events tests failed" }
npm --prefix Module_1_Adapter run build
if ($LASTEXITCODE -ne 0) { throw "Backend build failed" }
npm --prefix Module_2_Public_Website run typecheck
if ($LASTEXITCODE -ne 0) { throw "Public TypeScript check failed" }
npm --prefix Module_3_Admin_Panel run typecheck
if ($LASTEXITCODE -ne 0) { throw "Admin TypeScript check failed" }
```

For full project validation, run `npm --prefix Module_1_Adapter run check`, `npm --prefix Module_2_Public_Website run check`, and `npm --prefix Module_3_Admin_Panel run check` and stop at any error. These full builds require actual installed monorepo dependencies and were not executed in the limited packaging container.

## Push only the updated Event files after tests pass

```powershell
$paths = @(
 'Module_1_Adapter/database/migrations/098_editorial_events.sql',
 'Module_1_Adapter/src/lib/events-schema.ts',
 'Module_1_Adapter/src/modules/events/routes.ts',
 'Module_1_Adapter/src/modules/events/catalog.ts',
 'Module_1_Adapter/src/modules/events/parse.ts',
 'Module_1_Adapter/src/modules/events/parse.mjs',
 'Module_1_Adapter/tests/events-feed-catalog.test.mjs',
 'Module_1_Adapter/tests/events-editorial-pipeline.test.mjs',
 'Module_2_Public_Website/src/app/api/events/route.ts',
 'Module_2_Public_Website/src/lib/curated-events.mjs',
 'Module_2_Public_Website/src/lib/curated-events.d.mts',
 'Module_2_Public_Website/public/events-radar.html',
 'Module_3_Admin_Panel/src/app/events/sources/page.tsx',
 'docs/PCI_EVENTS_OPERATIONAL_RUNBOOK.md'
)
foreach ($p in $paths) { if (Test-Path $p) { git add -- $p } }
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw "Git whitespace check failed" }
git diff --cached --stat
git commit -m "Make PCI Events operational with verified notices and editorial publishing"
if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
git push origin main
if ($LASTEXITCODE -ne 0) { throw "Push failed" }
```

## Verify after Hostinger deploy

- Public site: `/events` should show three sourced notices while dates remain current, including on the static fallback map. Use All Cities and inspect each link and venue coordinate.
- Public API: `/api/events` must show `data` entries and `meta.backend_status`. The `editorial_mode` says explicitly this is **not** a live feed.
- Admin: `/events/sources` has live source presets and an owner-only "Publish verified organiser announcement" form; use an original organizer announcement and real venue coordinates. Owner can unpublish a record.
- Backend: ensure `.env` has real database credentials, `098_editorial_events.sql` runs, and `GET /api/v1/public/events` returns approved feed and editorial entries. Read live Hostinger logs for database errors.
- Error state: when all curated notices expire, the map will correctly show no events unless more approved events are available. It cannot guarantee indefinite coverage without actual future feeds.

## Tests performed while packaging

- Targeted Event, feed and integration suite: 34 passed, 0 failed (reconstructed checkout).
- Browser tested with all external tile/script requests blocked: three markers rendered, event detail card opened, correct source and venue data displayed.
- TypeScript/TSX: 5 changed code files passed parser/transpilation syntax checks, **not full typechecking**.
- Installer cold application and rerun: pass; prior-catalog upgrade and rerun: pass.
- Broader tests in the limited reconstructed checkout: backend 124/125 (only missing original `.env.example`), public 46/51 (only missing original dynamic pages/hero asset), admin 39/39. These fixture omissions do not establish the status of a build on your full local repo.
- Production Hostinger build, live database, production secrets, and live upstream feed fetch: **not verified**. Do not infer success from syntax tests.
