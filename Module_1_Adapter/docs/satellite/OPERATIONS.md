# PCI Satellite Operations Update — 22 November 2026

## Scope
This is a root-level overlay, not a complete repository and not a new Hostinger service.
Changes affect **only Satellite modules**, the Satellite admin screen and Satellite-specific frontend map and tests. The Events map HTML and all creator code remain untouched.

## What was fixed
- The Satellite map now uses an isolated MapLibre GL JS 5.21.0 iframe with the existing Events/OpenFreeMap dark style. No event route/assets change.
- Satellite city requests use the existing same-origin `/api/satellite` proxy rather than exposing a backend URL in the browser.
- Enabling a supported provider now automatically queues the first ingestion for the existing scheduler; disabling clears pending requests.
- NASA POWER ingestion reports partial city failures as failures, not successful full refreshes. Already valid observations may remain stored but the provider's last-success time is not falsely advanced.
- Admin screen gives explicit guidance on missing credentials, unimplemented connectors, pending ingestion and worker dependencies.
- Public page displays disabled, queued, backend-unavailable and not-yet-ingested states explicitly.

## What this does NOT implement
- GPM IMERG precipitation raster ingestion, Sentinel-1 flood segmentation, Sentinel-2 NDVI, Sentinel-5P atmosphere processing. These require separate scientifically validated upstream access, ingestion pipelines and outputs. They deliberately remain unavailable to enable in admin; do not label these working.
- The deployment cannot supply a NASA FIRMS MAP_KEY or run the Hostinger worker itself.
- We cannot infer the state of live Hostinger environment variables, worker heartbeat or migration from screenshots.

## Enable real data now
1. Open the PCI admin Satellite APIs page.
2. For NASA POWER check **Enable ingestion** then **Save source**. The new backend queues a first run automatically.
3. Confirm the Module 1 worker is running, either standalone or `RUN_WORKER_IN_API=true` (not both), and that migration `096_satellite.sql` is applied.
4. A refresh is processed by the existing scheduler (currently checks roughly every 15 minutes). Observe `Last attempted`, `Last succeeded` and `Most recent ingestion error` in admin.
5. To use FIRMS, obtain a free NASA FIRMS MAP_KEY and set `NASA_FIRMS_MAP_KEY` on the Module 1 server environment, redeploy Module 1, and enable FIRMS.
6. Refresh `/satellite` after a successful ingestion.

## Production safeguards
- Existing Express auth, role gate, CSRF and admin audit remain in effect.
- Sources and upstream URLs are allowlisted, never user-supplied.
- Existing satellite-specific Redis fail-closed read rate limit, 8-MB bounded upstream response, 20-second fetch timeout, and SQL batching remain unchanged.
- No events or ranking code is modified. The map handles empty detections without inventing points.

## Deployment checklist
1. Backup or commit the current PCI root.
2. Extract this ZIP over the PCI root, preserving directories.
3. Verify diff: only intended Satellite files.
4. Run the test, typecheck and build commands in TEST_REPORT.md.
5. Push only after all checks succeed. Confirm GitHub Actions and Hostinger deploy the intended commit.
6. In admin enable NASA POWER; verify Last succeeded and actual public observations.

**Never place NASA or Copernicus secrets in the browser or ZIP.**
