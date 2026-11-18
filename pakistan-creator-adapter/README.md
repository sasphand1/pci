# Pakistan Creator Index — Core Adapter (Module 1)

A backend-only, modular TypeScript application for a **curated directory of Pakistani YouTube channels**. It is designed to connect, via versioned APIs, to a separately built **public website (Module 2)** and **management panel (Module 3)**. One nationwide community wall is separate from YouTube comments. Not affiliated with or endorsed by YouTube.

## Implemented scope

- PostgreSQL creator registry, seven seeded editorial navigation sections, CSV-ready bulk JSON import (up to 100 creators per batch).
- YouTube Data API v3 (`channels.list`, uploads via `playlistItems.list`, `videos.list`): **latest up to 50 retrievable public videos per channel**, with 50-ID batching, bounded retries, quota accounting.
- Worker scheduled **09:00 Asia/Karachi daily** by default (Owner-configurable time/auto-sync switch) plus startup stale-data recovery and admin-triggered manual refresh; transactionally published current snapshot. Old publication remains if refresh fails.
- Raw metric sort/ranks (subscribers default, views, public video count). BigInt-safe totals and arithmetic means with sample denominators. Missing stats are never silently zeroed.
- Redis public cache + invalidation, global HTTP rate limit, chat anti-spam and session stores.
- One global live wall: guest nicknames **and** registered users; Cloudflare Turnstile at guest creation/registration; registration requires email verification; WebSocket broadcasting.
- Owner, Editor and Moderator roles, MFA using TOTP for every administrator, HttpOnly admin sessions, CSRF tokens, audit trail, wall moderation, creator/category/settings administration.
- Versioned API, OpenAPI reference, typed input validation, Docker Compose, tests and operational guides.

## Not included in v1

- No public/adaptive Bayesian or composite creator scores using YouTube API data, no historical growth charts or monetization estimates. Experimental formulas are isolated under `src/modules/ranking/research.mjs`, **never exposed by endpoints**.
- No frontend UI inside this ZIP. The public site and admin panel are intentionally separate projects.
- No real Pakistani channels prepopulated. Only the seven editable category names are seeded. Supply each creator's **verified UC channel ID**, not a guessed username.
- No backups-as-a-service, centralized SIEM, browser-based admin MFA enrollment flow, or scalable multi-node Socket.IO message fan-out. See production checklist.

## Quick start — Windows CMD + Docker Desktop

1. Install Docker Desktop (WSL2 enabled) and start its engine.
2. In CMD, enter the unzipped folder: `cd C:\path\to\pakistan-creator-adapter`.
3. Copy the environment template: `copy .env.example .env`.
4. Generate two independent strong 32-byte hex secrets:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (run twice).
5. Edit `.env` to set `DB_PASSWORD`, `MFA_ENCRYPTION_KEY`, `LOG_HMAC_KEY`, `PUBLIC_ORIGIN`, `ADMIN_ORIGIN`, and the needed integrations. For Docker deployment, `DB_PASSWORD` must be a strong random **URL-safe** string (hex is convenient).
6. Run `docker compose up -d --build`.
7. Check `docker compose ps` and `curl.exe http://localhost:8080/health/ready`.
8. Create the first admin **once**: `docker compose run --rm api node dist/cli/create-owner.js owner@example.com`.
9. Enter the one-time `otpauth://` URI into your authenticator (e.g., a QR generator you trust locally), save your initial password privately, then log in via `POST /api/v1/admin/auth/login` with `email`, `password`, and current 6-digit `totp`.
10. To ingest real YouTube data, set `YOUTUBE_API_KEY=...` and `YOUTUBE_SYNC_ENABLED=true` in `.env`; restart `docker compose up -d`; add verified channels via admin API, and enqueue a manual sync.

**The database and Redis have no host-exposed ports.** Only the API is bound to `127.0.0.1:8080` by default. For public hosting, use a TLS reverse proxy on the VPS and configure HTTPS origins. The API is not directly published on a public network by this Compose file.

**Production readiness:** `NODE_ENV=production` requires valid `TURNSTILE_SECRET_KEY`, `TURNSTILE_EXPECTED_HOSTNAME`, SMTP settings, and HTTPS origins, and refuses the development bot-check bypass. Do not switch to production without following `docs/DEPLOYMENT.md`.

## API usage overview

- Public: `GET /api/v1/meta`, `/site-config`, `/categories`, `/creators?sort=subscribers`, `/rankings?sort=views`, `/creators/:slug`, `/creators/:slug/summary`, `/creators/:slug/videos`, `/overview`, `/status`.
- Wall auth: `POST /api/v1/wall/auth/guest`, `/register`, `/verify-email`, `/login`, `/logout`, `/resend-verification`, `/forgot-password`, `/reset-password`; `GET /me`; `DELETE /account`.
- Wall: `GET /api/v1/wall/status`, `/messages`; `POST /messages`, `/reports`. Authenticated posting uses `Authorization: Bearer <wall-token>`.
- Real time: Socket.IO namespace `/wall`, events `wall:message_created`, `wall:message_removed`, `wall:presence`, `wall:status_changed`. Posting uses HTTP; sockets deliver notifications.
- Admin: `/api/v1/admin/auth/login`, `/me`, `/logout`; `/api/v1/admin/dashboard`, `/creators`, `/creators/validate`, `/creators/bulk`, `/categories`, `/sync-runs`, `/ranking-preview`, `/videos`, `/wall/reports`, `/wall/messages`, `/wall/bans`, `/settings`, `/system-health`, `/admins`, `/admin-password`, `/audit-logs`.

Complete paths, HTTP methods and parameters are in `docs/openapi.yaml`. Integration details and actual JSON response shapes are in `docs/MODULE_CONTRACTS.md`.

## Development and tests

- Dependency-free core test suite: `node --test tests/*.test.mjs`.
- After `npm install`: `npm run build` then `npm test`.
- With `.env` loaded, PostgreSQL/Redis reachable, and **a disposable test database**: `npm run test:integration` (requires `NODE_ENV=test`, `DEV_BYPASS_TURNSTILE=true`).
- Docker integration testing: `docker compose run --rm -e NODE_ENV=test -e DEV_BYPASS_TURNSTILE=true api node --test ...` is not provided because TypeScript integration tests need `tsx` (a devDependency); use a local dependency install, or create a one-time test image with devDependencies.

More detail in `docs/TEST_PLAN.md`.

## API-cost estimate for 100 channels

- `channels.list`: 2 batched calls.
- `playlistItems.list`: up to 100 calls (50 latest video IDs per channel).
- `videos.list`: up to 100 batched calls (5,000 IDs / 50).
- **~202 quota units per full successful refresh**, plus retries and separate admin validation calls. This is an estimate, not a guarantee. Daily default quota and applicable policy may change; check your Google Cloud Console.

## Structure

```
src/server.ts                 API process
src/worker.ts                 scheduler + retry loop
src/modules/youtube/         external Google API adapter
src/modules/sync/            authoritative collection + publication
src/modules/creators/        public creator/analytics endpoints
src/modules/ranking/         public exact ranking + isolated future research
src/modules/auth/            admin/guest/member authentication
src/modules/admin/           management API and RBAC
src/modules/wall/            single shared community wall
src/lib/                     DB/Redis/config/error/security primitives
database/migrations/         PostgreSQL schema and seed
src/cli/                     migrations + secure first-owner bootstrap
docs/                        contract, deployment and QA guides
```

## Security and accuracy boundaries

The system does not invent missing YouTube metrics; non-public subscriber counts remain null. Subscriber numbers are rounded by YouTube and are not exact individual-level measurements. Stored channel stats represent the latest completed ingestion. `views.mean` is a half-up-rounded arithmetic mean of available view counts **within the latest retrievable 50 uploads**; it is *not* a measure of lifetime channel performance. Rankings apply to your **curated 100 channels** and are not asserted to cover every creator in Pakistan. Combined subscriber counts are not unique people.

Review YouTube developer terms and applicable privacy/content laws before public launch. This ZIP is a software baseline, not an official API policy audit or a security certification.
