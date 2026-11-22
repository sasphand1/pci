# PCI Satellite Intelligence — V2 Change Log (2026-11-22)

## New features

- Single existing-PCI `/satellite` page, matching central `@pci/ui` design system.
- Existing management panel: Owner-only Satellite APIs configuration for allowlisted sources, activation flags, bounded cadence, last attempt/success/error, and queued refresh.
- Backend: FIRMS observations, NASA POWER corrected daily precipitation and solar resources, status/source metadata, public read-only endpoints and OpenAPI discovery.
- Existing Node scheduler reused; existing PostgreSQL and Redis reused; root overlay leaves unrelated files untouched.

## Hardening added in V2

- Separate satellite Redis rate guard: 60 requests/minute/IP (in addition to existing global limiter), with fail-closed 503 on Redis errors.
- 20-second upstream timeout and 8 MiB maximum decoded upstream download; corrupt UTF-8 fails ingestion.
- Parameterized batch SQL insertion, maximum 200 observations per round trip, mitigating excessive database transactions on large FIRMS feeds.
- Cached observation reads (30-second TTL), invalidated after provider config change and successful ingestion.
- NASA POWER null/empty sample values no longer turn into incorrect zeros.
- More tests: malicious SQL-shaped values, 1,000-request synthetic rate burst, Redis outage simulation, bounding upstream payloads, and unimplemented provider checks.

## Known gaps

- Six named providers are **NOT six implemented connectors**. Only FIRMS and POWER are functional source adapters.
- Actual user-defined third-party source URLs and public developer API-key tiers are NOT implemented intentionally; arbitrary URLs would introduce SSRF and credential-exposure risks.
- No Pakistan country polygon, district aggregation, authenticated live source requests, DB-backed runtime tests or Hostinger load tests have been proven in this environment.
- Do not deploy before full `npm run check`, DB/Redis integration and staging regression pass.
