# PCI Satellite — Hostinger operations and troubleshooting

## Before deploying
1. Extract at the PCI repository root; only Satellite-related files should be replaced. Do not modify Events.
2. Run backend, public website and admin tests and production builds. Do not push if any fails.
3. Do not commit `.env`, tokens, backup files, database dumps or local logs.

## Activate NASA POWER (no credentials)
1. Open management panel > Satellite APIs (Owner).
2. Check Enable ingestion for NASA POWER, click Save source. This patch also queues the first refresh.
3. Ensure the Module 1 process has a running scheduler (either the standalone worker or `RUN_WORKER_IN_API=true`, not both).
4. The existing scheduler checks for queued satellite jobs periodically (about 15 minutes in current repository).
5. Verify `Last attempted` and `Last succeeded`. Any error is shown on provider card.
6. Refresh public `/satellite`, select Lahore or Karachi, and confirm nonempty rainfall/solar with observation dates.

## Activate NASA FIRMS
1. Get your free key at https://firms.modaps.eosdis.nasa.gov/api/map_key/
2. Set `NASA_FIRMS_MAP_KEY` only in the existing Hostinger Module 1 server environment; redeploy Module 1.
3. Enable NASA FIRMS and Save source. Check processing timestamps. A successful empty set is possible: absence of FIRMS detections is not a system failure.

## If the public page stays empty
- If all source cards are absent, the Next.js process may not reach Module 1 or the migration may be missing.
- If NASA POWER says disabled, confirm the Owner saved the toggle.
- If the refresh stays queued and Last attempted does not change, check the Module 1 worker heartbeat, `RUN_WORKER_IN_API`, and scheduled tasks on Hostinger.
- If Last attempted moves but Last succeeded does not, inspect provider error and outbound HTTPS connectivity from Module 1.
- If Last succeeded has a timestamp but a specific city is empty, check upstream data lag, that city's stored observations and the time window.
- Confirm the current Hostinger deployment is built from the expected GitHub commit.

## Important distinctions
- NASA POWER estimates are daily modeled values, not real-time GPM or observed rainfall gauges.
- NASA FIRMS provides thermal anomalies, not confirmed fires.
- GPM and the three Sentinel geophysical processing connectors still require separate implementation. The user cannot activate them by editing provider flags.
- The map uses its own iframe and event channel, not the Events map instance or event API.
