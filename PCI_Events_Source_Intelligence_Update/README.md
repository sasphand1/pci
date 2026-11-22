# PCI Events — MapLibre, Waze and verified event sources

**PCI modules:** existing Module 1 Adapter, Module 2 Public Website, Module 3 Management Panel. No new server, application or domain. This update DOES NOT push to GitHub or deploy by itself.

## Installation (Windows PowerShell, from your current PCI_Clean folder)

1. Extract `PCI_Events_Source_Intelligence_Update.zip` to `Downloads`, retaining the top-level folder.
2. From `C:\Users\sasph\Documents\PCI_Clean` run this **local installer only** (no Git commands are included):

```powershell
node "$env:USERPROFILE\Downloads\PCI_Events_Source_Intelligence_Update\APPLY_PCI_EVENTS_UPDATE.mjs" "$PWD"
```

It copies the new event modules and carefully patches the existing Module 1 `server.ts`, `worker.ts`, `scheduler.ts`, Module 3 `src/lib/nav.ts`, Module 2 shared `SiteHeader.tsx`, and shared UI styles. Existing files are backed up inside `.pci-events-update-backups/`. The installer does not stage, commit or push anything. Re-running it will not add duplicate routes or navigation entries.

**Note:** apply changes to all three modules together. Hostinger's deployment will depend on each application's actual GitHub deployment configuration. No new services are required; the event source scheduler uses Module 1's existing scheduler.

## Resulting routes

- **Public:** `/events` — shared PCI header, existing MapLibre/OpenFreeMap holographic map, updated Waze navigation in each approved event card, venue link, universal sharing icon and Rackelto Technologies Ltd signature.
- **Public data:** Module 2 `/api/events`, proxied server-side to Module 1 `/api/v1/public/events` (not a separate paid API).
- **Management:** `/events/sources` — existing owner/editor management shell; create/edit RSS, iCalendar and JSON sources; enable or disable; test; sync; review and approve event records; view logs.
- **Admin API:** Module 1 `/api/v1/admin/events/*` authenticated via existing admin session + MFA, CSRF and owner/editor role permissions.

## Official source workflow

1. In **Management > Event sources**, choose **Add source** and paste an official feed URL (HTTPS).
2. Set format (ICS, RSS/Atom, structured JSON), event category and optional verified single-city scope (Karachi, Lahore, Islamabad).
3. Only confirm `Official source` and `Reuse rights` when personally verified. Save; use **Test feed** to inspect counts without publishing.
4. Enable and select **Sync now**. Imported records are **pending**, not visible to visitors.
5. Inspect the official event announcement, venue, date and ticket details. Provide venue coordinates if the feed lacks them. Click **Approve**. The public map shows only approved, future, correctly located records from enabled and confirmed sources.
6. Disable a feed to hide all its events without deleting data. Changing feed URL, type, category or city resets that source's prior approvals. Changes to a source event's material fields also reset its approval.

A daily check is registered for **07:30 Asia/Karachi** in the existing Module 1 scheduler. This runs only if PCI already runs its worker or `RUN_WORKER_IN_API=true`. Manual testing and sync are available independently.

## Supported and unsupported data

- **ICS:** future one-off `VEVENT` records, `DTSTART`/`UID`/`LOCATION`/`GEO`/`URL`. Missing coordinates require human entry. `RRULE` recurrences and non-Pakistan time zones are excluded rather than misdated.
- **RSS/Atom:** recognizes event-specific `event:startDate` / `startDate` / `dtstart`, location and geolocation tags. **Never uses article `pubDate` as an event date**. Generic newspaper feeds therefore do not create events.
- **JSON:** explicit event arrays, including Confs.tech-like records and TheSportsDB event fields. TheSportsDB often omits venue coordinates, and free tier coverage is limited; approve records only with independently validated locations. Only cities Karachi, Lahore and Islamabad are accepted. No generic city-centre pins are fabricated.
- Feed fetches use HTTPS only, public IPv4 DNS validation, pinned DNS resolution, strict limits, request timeouts and no credentialed URLs. There is no scraping.
- No source URL is pre-enabled, no event data is fabricated or auto-published, and no unverified ticket price is shown as fact. A verified feed must actually be configured to populate the map.

## Waze

The small `Waze` link in the event hover card opens `https://waze.com/ul?ll=<latitude>,<longitude>&navigate=yes`. Voice-guided navigation and traffic run in the user's Waze app, **not** embedded in MapLibre. An internet connection and Waze availability are required; no Waze API key is needed for Deep Links.

## Tests performed when building this package

- **18 Node tests passed:** secure feed URL validation; RSS future-date discipline; ICS parsing including all-day and unsupported time zones; TheSportsDB JSON; city/venue/price validation; published-data gating; Waze URL generation; escaping; filtering; share signature; and TypeScript runtime/parser parity.
- TypeScript/TSX **syntax** checks passed; embedded browser JavaScript parser checks passed.
- Local installer applied successfully twice to a synthetic repository fixture, confirming idempotent integration.
- **Not verified in this environment:** end-to-end Next.js/PostgreSQL/Redis deployment; live external RSS/ICS/API fetches; MapLibre tiles; authenticated admin flows; actual Waze voice guidance; real-browser UI screenshots. Browser network loading was blocked by this execution environment and installed dependencies/DB are unavailable. Do not mistake static tests for a live service acceptance test.

### Local tests after applying to your full PCI checkout

From the repository root:

```powershell
node --test Module_1_Adapter/tests/events-*.test.mjs
```

With Node dependencies and services configured, also run the project's existing Module 1, Module 2 and Module 3 type checks, tests and builds, then verify the actual Hostinger deployment and admin connection. Until a verified feed is enabled and human-approved, `/events` should truthfully display **no verified upcoming events**.

## Source documentation

- Waze Deep Links: https://developers.google.com/waze/deeplinks/
- OpenFreeMap: https://openfreemap.org/
- Public Google Calendar ICS: https://support.google.com/calendar/answer/37083
- Confs.tech dataset: https://github.com/tech-conferences/conference-data
- TheSportsDB v1 free API (limitations apply): https://www.thesportsdb.com/documentation

**Important:** Official websites and ticket portals without a documented, permitted feed/API are not ingested automatically. For those, obtain a public organizer calendar/feed or direct authorization. Source reuse permissions remain the operator's responsibility.
