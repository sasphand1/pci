# PCI Satellite Intelligence — Ethical, Resilient Software Architecture

## Scope / architecture

This is **one page within the existing Hostinger-hosted PCI site**. No new site, DB server, standalone Python API or hosting provider. Source of truth stays in Module 1 Node.js/Express, current PostgreSQL and Redis; Module 2 is Next.js; Module 3 is the existing Owner management console. Six sources are listed, **two implemented (FIRMS and POWER)**. GPM and Sentinel-1/-2/-5P are disabled placeholders; no live claims are made.

## Trust boundaries

| Boundary | Policy |
|---|---|
| Browser → public satellite GET | GET/HEAD only for data retrieval; independent per-IP Redis limiter 60/min and global PCI limiter; bounded response and history ranges |
| Admin → source configuration | Require existing session auth, Owner role and existing CSRF protection; audit updates and queued refresh actions |
| PCI → upstream NASA | Hardcoded vetted domains/paths, 20-second HTTP timeout, 8 MiB response cap; FIRE key stored server-side only |
| Ingestion → PostgreSQL | Fixed source list, typed metrics, normalized observations, 200 rows per parameterized batch, 90-day raw retention |
| Redis outage | New satellite public reads return 503 instead of flooding PostgreSQL; creator platform unchanged |
| API output | Include source, dates, units, estimation caveats; never state a hotspot is a confirmed fire or POWER rainfall is GPM |

## Fair and responsible use

- Do not label bounding-box detections as inside Pakistan. The region includes locations beyond Pakistan's legal boundary.
- No district-level or household-level claims from point-based POWER or regional FIRMS feeds.
- Do not give emergency evacuation, flood, or air-quality safety instructions based solely on satellite estimates; provide links to relevant official agencies.
- Do not infer individual property ownership, household behavior, criminal activity or responsible parties from hotspot coordinates.
- Always show observation timestamp and attribution, and show missing values as unavailable rather than zero.
- Review NASA reuse obligations, FAIR data stewardship and OpenStreetMap basemap terms before commercial redistribution.
- API source management means **enable/disable and cadence** for fixed reviewed providers; it does not allow arbitrary custom endpoints or credentials through the browser.
- Cross-origin public GETs are accessible without credentials, subject to throttling; this pilot does not implement public developer API keys/tier quotas. Do not advertise them as completed.

## Operational safeguards and known limitations

- Redis 30-second read caching protects recurring requests. Cache epoch changes on successful ingestion and source toggle. Cold-cache concurrent requests across multiple replicas can still cause load spikes; implement pre-warming, CDN and a distributed request coalescer if usage grows.
- One in-process satellite tick is active per worker; provider claims are made in SQL. Unexpected process exit is eventually retried based on refresh interval. This is not a durable job broker; dedicated queue and leasing should be revisited after a real load profile.
- Upstream HTTP quotas/data availability can change. Handle failure with transparent stale/unavailable status, not fake readings.
- Reverse proxy `TRUST_PROXY` and real client-IP interpretation must be verified on Hostinger before relying on per-IP limits. A shared NAT can cause fair-use throttling.
- Data retention and query caps control resource growth. Run disk/CPU/DB connection monitoring before enabling production ingestion.

## Minimum next validation

Full builds, DB migration and rollback rehearsal, live NASA fixtures and official source schema, Redis outage test, authentication regression, Hostinger staging load test and observability/alerting. **No absolute guarantee against a website crash is scientifically possible.**
