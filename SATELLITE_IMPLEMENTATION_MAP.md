# PCI Satellite Intelligence — Exact Integration Map

| Existing module | Paths changed or added | Purpose |
|---|---|---|
| Module 1 adapter | `src/server.ts` | Satellite public and protected admin mounts; separate fail-closed satellite rate limiter |
| Module 1 adapter | `src/modules/satellite/{routes,service}.ts` | Validated public reads, provider management, ingestion, scheduling and caching |
| Module 1 adapter | `src/modules/satellite/catalog.mjs`, `catalog.d.mts` | Approved fixed provider catalog; deterministic NASA parsing |
| Module 1 adapter | `src/modules/satellite/guard.mjs`, `guard.d.mts` | Traffic limit decision and bounded upstream response reader |
| Module 1 adapter | `src/modules/satellite/bulk.mjs`, `bulk.d.mts` | Bound/parameterize multi-row observations for DB safety |
| Module 1 adapter | `database/migrations/096_satellite.sql` | Additive isolated schema and indexes |
| Module 1 adapter | `src/modules/sync/scheduler.ts` | Use existing cron engine; scheduled ingest and retention |
| Module 1 adapter | `scripts/copy-assets.mjs` | Include .mjs runtime helpers in TypeScript compiled build |
| Module 2 public | `src/app/satellite/page.tsx`, `src/components/SatelliteDashboard.tsx` | Integrated page with truthful source and freshness display |
| Module 2 public | `src/components/{SiteHeader,SiteFooter}.tsx`, `src/app/sitemap.ts` | Navigation, footer and SEO |
| Module 2 public | `packages/ui/src/styles.css`, `packages/ui/src/styles/satellite.css` | Existing central `@pci/ui` styling |
| Module 3 admin | `src/app/satellite/page.tsx`, `src/lib/nav.ts` | Owner-only configuration page |

## Public endpoint contracts

All under `/api/v1/satellite`:

- `GET /sources`
- `GET /fires/latest?limit=100`
- `GET /fires/history?days=7`
- `GET /rainfall/latest?city=lahore`
- `GET /rainfall/history?city=lahore&days=7`
- `GET /solar/latest?city=lahore`
- `GET /solar/history?city=lahore&days=7`
- `GET /openapi.json` (documentation metadata)

All under `/api/v1/admin/satellite`, Owner only:

- `GET /providers`
- `PATCH /providers/:id` JSON `{ "enabled": true, "refreshMinutes": 180 }`
- `POST /providers/:id/refresh` (queues, returns 202)

Source IDs: `firms`, `power`, `gpm`, `sentinel1`, `sentinel2`, `sentinel5p`. Only the first two have connectors.
