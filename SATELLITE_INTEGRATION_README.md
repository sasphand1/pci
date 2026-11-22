# PCI Satellite Intelligence — additive overlay (22 November 2026)

## Scope and truthfulness
- One `/satellite` page integrated into Module 2 with `@pci/ui`.
- Owner-only `/satellite` management page in Module 3 to enable/disable *allowlisted* satellite providers, change their refresh cadence, view ingestion state, and request manual refresh.
- Seven public REST endpoints: `/api/v1/satellite/sources`, `/fires/latest`, `/fires/history`, `/rainfall/latest`, `/rainfall/history`, `/solar/latest`, `/solar/history`.
- **Implemented external connectors: NASA FIRMS VIIRS and NASA POWER only.** NASA GPM IMERG and the three Sentinel feeds are registered but deliberately **not implemented, cannot be enabled**. This is not six working satellite APIs and not twelve completed outgoing endpoints.
- POWER daily rainfall is *PRECTOTCORR*, **not GPM**, and is a regional satellite/model-corrected estimate. FIRMS are **thermal anomalies**, not confirmed forest fires. No invented values or misleading live-risk claims.

## Deployment
1. Back up the entire PCI root and PostgreSQL database. Extract this overlay ZIP over the matching repository root; existing files are updated, unrelated files are preserved.
2. Deploy Module 1 first. Apply `096_satellite.sql` via existing migration process (requires successful `npm run migrate`). Redeploy the API/worker, avoiding two scheduler owners. The existing `RUN_WORKER_IN_API` support handles single-process hosting.
3. In Module 1 Hostinger environment variables, configure `NASA_FIRMS_MAP_KEY` obtained from NASA FIRMS. NASA POWER needs no secret. Never put credentials in NEXT_PUBLIC_* env vars.
4. Deploy Module 3, log in as Owner, open **Satellite APIs**, enable `power` and `firms` when ready, save, then use Refresh now (queues ingestion for the existing PCI worker; does not block the browser).
5. Deploy Module 2, open `/satellite` and verify data freshness and attribution.
6. `npm run check` in all three module roots after dependencies are installed, plus end-to-end checks using real database/Redis and provider credentials. The ZIP purposefully does not contain secrets, `.env`, dependencies or lockfiles. Live ingestion and DB migration cannot be proven without your Hostinger environment.

## Security and ethical safeguards
- Provider URLs are constant/approved, not editable; protects against SSRF and untrusted endpoints.
- Only admin `owner` can modify or refresh; existing requireAdmin middleware validates CSRF; every configuration change and successful refresh is audited.
- Upstream keys are private server environment variables. Provider availability and errors expose no credentials.
- Response data includes satellite source, observation timestamp, limitations and units. Unavailable values stay unavailable, never zero.
- Public GET only; bounds on days and response sizes; existing PCI global rate limit applies. No separate public developer-key tiers or geospatial PostGIS for this first overlay.
- NASA dataset reuse/attribution must be verified before commercial redistribution; place notices on the page. Not a substitute for disaster authority alerts.

## Known constraints
- Pilot: 8 fixed city points for POWER, Pakistan-region FIRMS bounding rectangle (may include detections outside borders). Not district-grade geospatial analysis.
- Without a country polygon, FIRMS bounding-box detections should never be called exclusively Pakistan detections.
- FIRMS uses latest SNPP VIIRS NRT endpoint; data feed availability and NASA rate limits can change. For initial deployment validate credentials and response shape with a real source call.
- Ingestion stores per-hotspot payloads in PostgreSQL. Add retention and aggregation before heavy traffic, since large fire feeds may increase storage.
- No live-provider/network integration tests were possible in the offline build environment.

## Visualization and load considerations
- A lightweight longitude/latitude plot is included for FIRMS; it is explicitly **not a national-border map**. Do not interpret it as district-level hazard mapping. Future polygon/tiles integration needs country boundaries and data licensing verification.
- NASA FIRMS may return many detections. Protect PostgreSQL size with a retention migration and an aggregate materialization before enabling a high-traffic deployment.
- `refresh` in the Owner panel queues a request, serviced by the existing 15-minute scheduler tick.
- External browser applications may consume public satellite GET APIs through permissive CORS, but management endpoints remain restricted.

## Endpoint documentation
The machine-readable v1 satellite OpenAPI discovery document is `GET /api/v1/satellite/openapi.json`. The regular creator ranking `/docs` retains its existing independent contract.
Retention: daily removal of observations older than 90 days (historical analysis longer than 90 days requires a future aggregation/archival strategy).

## V2 traffic hardening update

The new public satellite endpoints have a dedicated fail-closed rate limiter (60 requests/minute/IP), while the existing global PCI limiter remains unchanged. Upstream downloads are capped to 8 MiB and 20 seconds, observation insertions use parameterized batches of 200, and satellite reads use Redis caching for 30 seconds with epoch invalidation on successful ingestion/config updates. See `SATELLITE_SECURITY_ARCHITECTURE.md` and `SATELLITE_TEST_REPORT.md` for tested behavior and limitations.

**Release status:** Validation pending. This archive is a root-level patch candidate, *not* a verified Hostinger production release. Execute all original module checks and staging/real-provider integration tests before deployment.
