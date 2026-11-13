# Build status and verification evidence — 12 November 2026

## Delivered source

- Module 1 source and Docker Compose for API, worker, PostgreSQL, Redis, and migrations.
- Public creator directory, channel summaries, video sample, raw metric rankings; registered and guest live wall; owner/editor/moderator APIs.
- Background 09:00 Asia/Karachi sync + manual queue, up-to-50-video ingest, freshness metadata, Redis cache and rate limits.
- Owner TOTP bootstrap, admin MFA, CSRF, role enforcement, registered-user email verification and reset-password flows.
- OpenAPI contract, module contract guide, deployment guide, and testing checklist.

## Checks actually performed in this authoring environment

- `node --test tests/*.test.mjs`: 21/21 native tests passed.
- Global TypeScript `transpileModule` syntax pass: 17 TypeScript source files parsed, zero syntactic diagnostics.
- `docs/openapi.yaml`: parsed successfully with PyYAML.
- Cross-checked public/wall/admin paths against the OpenAPI manifest.
- ZIP packaged with source and docs (no `.env`, production secrets or `node_modules`).

## Not verified here — required on your workstation/VPS before release

The authoring container has no Docker installation, and its npm registry DNS access is unavailable
(`EAI_AGAIN`). Therefore npm package installation, complete TypeScript typecheck/build,
PostgreSQL/Redis integration tests, real YouTube API ingestion, SMTP/Turnstile verification
and browser/WebSocket production tests **have not been run** here. No claim of production certification
or end-to-end execution is made. Run the checklist in `TEST_PLAN.md` and use
`DEPLOYMENT.md` for Windows/Docker instructions before opening public access.

## Architectural and release limits

- One API and one worker instance; Redis-backed multi-replica WebSocket broadcasts are not part of v1.
- Today's raw metric rankings are for the *curated set of channels*, not an objective index of all Pakistan.
- Experimental Bayesian/Wilson math uses synthetic samples only; not enabled for live YouTube API data.
- YouTube non-authorized statistics are refreshed/replaced, not retained as multi-year histories.
- Security controls still require correct TLS, reverse-proxy, Turnstile, SMTP, secrets, backups, and external security review.
