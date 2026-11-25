# Data Hub — completion report (Nov 2026)

## What the hub does
- **One store.** Every reading from every source is stored once in `ingest_observations`; the newest accepted value per field is in `ingest_latest`.
- **API first.** A web (http) reading replaces an API value only when the API source is down or has not supplied that field for 7 days. Disagreements over 5% are logged (`hub_discrepancies`).
- **Every reader uses it.** Rankings (`ingest_latest`), public site, creator profiles, analytics, admin overview and coverage (`hub_account_metrics` view). `PCI_INGEST_RANKING=false` is an emergency rollback for rankings only and logs a warning.
- **Old table bridged.** Each write to `metric_observations` is copied into the hub in the same transaction (trigger); the full old history was copied once (`hub_meta.legacy_history_v1`).
- **Any category.** Sources are `<family>.<api|http|manual>` with a category and an expected delivery interval; entities can be accounts, content, places, commodities, trends, cities. Decimals are stored with `value_scale`. Google Places (restaurants) is the first non-creator source.
- **Monitoring.** Every 15 minutes: no data / stale (relative to each source's own interval), endpoint changed, blocked, quota, coverage, Instagram token and rate limits. Critical alerts email `HUB_ALERT_EMAIL`. Shown on the admin Data Hub page with stored data per category.
- **History.** Every published ranking is kept permanently in `rank_history`; `hall_of_fame` gives the holders at the end of each week and month. Public endpoint: `GET /api/v1/public/hall-of-fame`.
- **Clean deletes.** Deleting a person removes their readings, latest values, content, disagreements and ranking history.
- **Retention.** Platform statistics follow `PCI_RETENTION_DAYS_<PLATFORM>` (default 90 days); Google Places readings 30 days; PCI's own ranking history is permanent.
- **Documented.** `docs/hub-openapi.json` (also served at `GET /api/v1/admin/ingest/openapi.json`), checked against the routes by tests.

## Tests
- Module 1: 225 static tests and 238 unit/engine tests pass; migrations 001–111 apply to an empty PostgreSQL 16 database and the startup schema runs twice without error.
- Module 3: 54 tests pass. Module 2: 119 tests pass.

## Still to decide (not hub work)
- Folders `pakistan-creator-adapter`, `Pakistan_Creator_Index_Module_2`, `payload` look like older copies of the modules, and `app.py`, `browser_launch.py`, `static/` are a separate tool (SSM_Tool). Delete them once you confirm Hostinger does not deploy from them.
- `local_places` (the restaurant list shown on the site) still keeps place details beyond 30 days; check this against the Google Maps Platform terms.
