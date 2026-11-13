# Deployment & Operations — Docker Compose / Windows / VPS

## Before exposing the adapter to the internet

1. Use a supported x64 Linux VPS with Docker Engine and Compose plugin. Deploy behind an HTTPS reverse proxy (Caddy, Nginx or Traefik). Never expose PostgreSQL or Redis ports.
2. Supply a DNS name like `api.example.com` and use **HTTPS** for the public site, admin site and API. All admin components should be on the same *site* (eTLD+1 and scheme) for SameSite=Strict cookies to work, e.g. `admin.example.com` and `api.example.com`.
3. Configure `.env`: strong URL-safe `DB_PASSWORD`, both unique 32-byte hex application keys, verified YouTube Data API key, valid Cloudflare Turnstile secret and expected hostname, and production SMTP. **Never commit `.env`**.
4. Set `NODE_ENV=production`, `DEV_BYPASS_TURNSTILE=false`, `PUBLIC_ORIGIN=https://www.example.com`, `ADMIN_ORIGIN=https://admin.example.com`, `APP_PUBLIC_URL=https://www.example.com`.
5. Set `TRUST_PROXY=1` only if your HTTPS proxy is the sole trusted hop forwarding to `127.0.0.1:8080`. Do not trust user-supplied forwarded headers directly. Validate your proxy configuration and real IP handling before enabling public rate limiting.
6. Enable `YOUTUBE_SYNC_ENABLED=true` only after verified channel IDs and an API key are configured. No API keys may be embedded in the frontend or Docker build layers.
7. Configure off-host encrypted PostgreSQL backups and restore tests; do not rely only on Docker named volumes. Protect admin MFA recovery material and credentials in a password manager.
8. Provide public Privacy, Terms and moderation pages before opening user registration and the wall. Document data retention (7 days for messages; longer where required for security or abuse reports) and contact for reports/removal requests.
9. Check current YouTube API terms. Initial release sorts only by raw metrics. Experimental ratings/composite algorithms remain disabled and must never be used on real YouTube public data without applicable permission.

## Docker commands

Windows Command Prompt (from project directory):

```bat
copy .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
rem Manually edit .env and replace all placeholders.
docker compose up -d --build
docker compose ps
docker compose logs --tail 100 api
docker compose logs --tail 100 worker
curl.exe http://localhost:8080/health/ready
```

Create the initial owner **exactly once** (record credentials and MFA URI offline):

```bat
docker compose run --rm api node dist/cli/create-owner.js owner@example.com
```

For subsequent admin users, the Owner invokes `POST /api/v1/admin/admins`; roles are enforced by the server.

To stop without deleting data: `docker compose down`. **Do not** run `docker compose down -v` on a database you want to keep.

## Published ports

- API container port 8080; host bind `127.0.0.1:${API_HOST_PORT:-8080}` only.
- PostgreSQL 5432 and Redis 6379 are internal-only on the Compose bridge network.
- Reverse proxy terminates TLS and forwards to local `127.0.0.1:8080`; configure rate limits and request body caps at both proxy and application layers.

## Admin UI integration security

- Use fetch `credentials: 'include'` against same-site API.
- `POST /api/v1/admin/auth/login` returns CSRF token after password+6-digit TOTP; every subsequent state-changing admin request needs `X-CSRF-Token`.
- TOTP secrets are AES-256-GCM encrypted at rest, derived from `MFA_ENCRYPTION_KEY`; **losing/rotating that key invalidates previous MFA enrollments** and requires a documented owner recovery process.
- Passwords use Argon2id; session tokens exist in Redis as SHA-256 keys. Admin sessions expire after 8 hours by default. Role changes/revocation increment session version.
- Admin provisioning gives one-time credentials in API response, which must only be shown transiently through TLS and never logged or saved in the frontend.

## Live wall operations

- Cloudflare Turnstile must be enabled on both guest and registration forms in production; send `turnstileToken` in initial POST.
- Registered accounts use email/password and SMTP verification before login. Guest accounts don't require email, but have sessions, anti-bot and rate limits.
- Wall messages are ephemeral; default retention is 7 days. Moderation reports cascade on expired messages, while admin audit logs are a separate retention class.
- Redis is required for secure authentication/session issuance and flood control: failure makes these operations unavailable rather than allowing unprotected posting.
- One Socket.IO server instance is assumed. For horizontal scaling later, add Socket.IO Redis adapter and centralized/persistent presence accounting before adding multiple API replicas.
- Guest bans are identity/session bans, **not** permanent device or network bans. New guest identities can circumvent them, so Turnstile, IP-based issuance throttles, manual moderation, and optional later reputation controls are necessary.

## Data refresh and consistency

- Worker defaults to 09:00 Asia/Karachi (UTC+05:00); Owner can edit `sync_schedule_time` and pause automatic refresh with `sync_schedule_enabled` and checks for a snapshot older than 24 hours at startup.
- Manual admin refresh is idempotently queued. Two jobs do not publish concurrently; the previous snapshot remains visible if a new one fails.
- Each 100-channel refresh needs roughly 202 successful API calls when each channel has 50 accessible uploads, plus retries. Quota consumption is tracked by request attempt; compare with Google Cloud Console when debugging.
- The latest-50 video sample is *not* the 50 most-viewed videos of all time. The most-viewed sort is only within that sample.
- Current stats are replaced; no historical API-derived stats warehouse is created. Video rows that fall outside the active latest-50 sample are removed on successful update.
- Explicit timestamps and count-as-string contracts are required in all frontend displays. Use staleness labels rather than showing old values as live.

## Backups, recovery, monitoring

Database example (run from a secured VPS, write archive outside the repo, encrypt before offsite upload):

```bash
docker compose exec -T db pg_dump -U pci -d pci -Fc > pci_$(date +%Y%m%d).dump
```

Periodically restore into a **separate new test database**. Test SQL migrations before deploying schema changes. The migration runner applies numbered `.sql` files in order and tracks them in `schema_migrations`. It does not auto-rollback schema alterations; prepare a rollback plan.

Health endpoints: `/health/live` process probe; `/health/ready` PostgreSQL+Redis readiness. `/api/v1/admin/system-health` is Owner-only and shows dependency status and recent estimated quota use. Logs are structured and redacted; integrate your VPS provider's log collection/alerts before launch.

Red flags: no successful sync in >24h, repeated API 403/429, unexpected jump/dip in counts, empty video sample for historically active channels, DB pool pressure, sustained Redis disconnections, high 401/403/429 volume, spam/report backlog, moderation unavailability. Alerts are a **deployment operator responsibility** in v1, not an embedded cloud alerting system.

## Important first-release limitations

- This codebase has not yet been penetration-tested or externally audited. Security mechanisms are included, but configuration and verification matter.
- No bundled production SMTP, Turnstile service, Google API key, TLS certificate, DNS configuration, WAF or backup service is supplied.
- No user-facing public/admin frontend in the adapter ZIP; those are Module 2 and 3.
- Advanced analysis scores and long-retention statistics remain unimplemented/disabled for public data.
- The environment in which this ZIP was authored could not fetch npm packages or run Docker. Before going live, **must pass `npm run build`, native unit tests, integrated PostgreSQL/Redis tests, real YouTube synchronization tests and security acceptance checks** on your machine.
