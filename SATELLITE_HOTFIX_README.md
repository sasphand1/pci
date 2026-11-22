# PCI Satellite immediate-refresh and recovery hotfix

## Verified code defect
The previous admin refresh only queued a database timestamp. The satellite cron checked every 15 minutes and there was no immediate dispatch. The previous claim also erased the queue marker before ingestion finished, meaning a killed worker could strand the request.

## Changes (Module 1 only)
- Admin **Save enabled** and **Refresh now** trigger asynchronous `satelliteTick()` on the already-running Module 1 Node process, immediately after returning the HTTP response. They do not block the admin request on NASA downloads.
- A duplicate pending refresh gets `202 queued` instead of an ambiguous `409`.
- Satellite worker also runs once when the existing PCI scheduler starts and polls every minute.
- Job claim preserves `refresh_requested_at` until ingestion completes and uses an aged-claim timeout (5 minutes) for crash recovery. This is not an exactly-once guarantee; database uniqueness prevents duplicate rows.
- Fix readonly-tuple TypeScript compile issue.
- Reuse existing authorized API, no new services, no edits to Events or creator functionality.

## Verify from PCI root (PowerShell)
```
npm --prefix Module_1_Adapter test
if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
npm --prefix Module_1_Adapter run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
```
After deploying Module 1, re-open Satellite APIs -> NASA POWER -> Save source or Refresh now -> Reload. Verify `Last attempted`, `Last succeeded`, and public rainfall/solar values. Missing values can still indicate a live NASA or Hostinger network failure; inspect `last_error` in admin.

## Not implemented or verified
- NASA FIRMS still requires a valid key `NASA_FIRMS_MAP_KEY` in Module 1 runtime.
- GPM IMERG, Sentinel-1, Sentinel-2, Sentinel-5P are **not implemented** by this hotfix; enabling them remains prohibited. They need source-specific acquisition, quality controls and science validation. Do not claim six active APIs.
- No live Hostinger process, NASA responses, or database state was accessed. This is code-level testing only; successful upstream ingestion requires deployment and backend connectivity.
- If Module 1 is running in a serverless environment that suspends processes after requests, a reliable scheduled worker is still required. Hostinger managed Node hosting behavior must be checked in deployment.

## Risks and resilience
- Existing PostgreSQL-based claims protect against concurrent processes at claim time; retries are at-least-once after failure/timeout, made safe by observation uniqueness.
- Existing Redis rate limiting, upstream timeouts and payload bounds remain.
- `setImmediate` runs only while the persistent Node process stays up; this is deliberately not used as durable queue ownership. The database queue remains the source of truth.
- Deploy backend first; no frontend/admin change required for this specific defect.
