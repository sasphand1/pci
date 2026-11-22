# PCI Events & Satellite — Hostinger integration repair

## Architecture

- Module 1: Satellite ingestion, event-feed ingestion, owner-managed source review, public read-only APIs; PostgreSQL and Redis remain on existing Hostinger deployment.
- Module 2: The **single** Next.js `src/app/layout.tsx` renders the shared `SiteHeader` on `/`, `/events`, `/satellite` and every other public route. `/events` embeds only the map widget; it does not render a second site header. Satellite uses a normal Next.js page. CSS remains in the `@pci/ui` system.
- Module 3: Its existing secured management shell displays Event Sources (`/events/sources`) and Satellite APIs (`/satellite`). Management API mutations require authenticated Owner and CSRF. The vendor copy of `@pci/ui` receives the Events management stylesheet, so the admin page is styled in production.

## Source and publication rules

Event feed sources must be approved and enabled by the Owner and may use supported HTTPS RSS/Atom, ICS, or structured JSON feeds. Imported events never automatically become public. Approve event date, venue, city, and coordinates in the management panel before publication. Only the existing three city scopes appear on the Events map. Waze opens external navigation with the selected event's coordinates and provides voice guidance in Waze, **not embedded PCI audio**. No fabricated events or admission information should be published.

Satellite currently uses the existing NASA FIRMS (regional thermal anomalies, not confirmed fires) and NASA POWER (satellite-derived historical rainfall and solar estimates, not live gauges). Other providers remain disabled unless implemented. The same-origin `/api/satellite` endpoint proxies safe read-only city requests to Module 1. NASA credentials belong in Hostinger environment variables, never in web-admin forms or browsers.

## Deployment requirements

1. The `Module_1_Adapter` Hostinger build must include `src/modules/satellite/*.mjs`, `*.d.mts`, `routes.ts`, and `scripts/copy-assets.mjs`. These source files were present in the GitHub repository when this repair was prepared.
2. `Module_1_Adapter/database/migrations/096_satellite.sql` and `097_events.sql` must exist. API/worker bootstrap is idempotent; production errors are logged and source endpoints may remain unavailable until database rights are corrected.
3. Set `ADAPTER_INTERNAL_URL` on Module 2 for its backend, and configure allowed frontend origins in Module 1. `NEXT_PUBLIC_ADAPTER_API_URL` should be set if other browser features need it. The new Satellite city proxy does not require direct browser requests to Module 1.
4. Enable exactly one scheduler: `RUN_WORKER_IN_API=true` or a running standalone worker. Event-source scheduled sync and Satellite ingestion require a running scheduler.
5. Hostinger builds each module from GitHub `main`. Pushing to GitHub alone is not a substitute for a successful Hostinger build and runtime checks.

## Checks

Run from the root of the Windows PCI checkout:

```powershell
node --test Module_1_Adapter/tests/events-*.test.mjs Module_1_Adapter/tests/satellite-*.test.mjs Module_1_Adapter/tests/pci-integration-contract.test.mjs
npm --prefix Module_1_Adapter run build
npm --prefix Module_2_Public_Website run check
npm --prefix Module_3_Admin_Panel run check
```

Production smoke checks: backend `/health/ready`; public `/events` and `/satellite` with identical main navigation; admin `/events/sources` and `/satellite` with Owner role; public `/api/events`; Satellite source, rainfall, and solar endpoints via backend. Add a **test authorized feed** and confirm an unapproved record is not visible publicly. Test event Waze link on a phone with a valid approved destination. Check server logs for schema, scheduler or upstream errors.

The package does **not** contain API keys, sample events, migrations to delete data, or push commands in the installer. Existing Satellite backend code is never replaced by the installer. Backups for changed files are saved under `.pci-repair-backups/` in the checkout.
