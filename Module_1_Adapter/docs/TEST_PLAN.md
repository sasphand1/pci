# Adapter Test Plan and Acceptance Criteria

## Test levels

1. **Native Node unit tests (`npm test`):** BigInt ranking, missing counts, tie behavior, stable ordering, numeric correctness, experimental research math with synthetic data, structural checks.
2. **API integration (`npm run test:integration`):** Requires disposable migrated PostgreSQL/Redis and environment: `NODE_ENV=test`, `DEV_BYPASS_TURNSTILE=true`; verifies public API, rank input validation, auth denial, origin denial, wall guest flow, duplication control and dependencies.
3. **Manual integration:** Real YouTube API key + a small set of verified public test channel IDs; compare API response with stored snapshot, inspect quota usage and missing-count handling. Do not paste API keys in logs/reports.
4. **Browser tests after Module 2/3:** On Windows Chrome/Firefox and mobile: creator pages, MFA cookie/CSRF flow, keyboard-accessible moderation, Socket.IO live wall under two independent sessions and reconnection.
5. **Security and load testing:** Authorized vulnerability scan against isolated staging, rate limiting, origin enforcement, user-session revocation, valid/invalid TOTP, SQL injection attempts, spam/flood, XSS in messages, abuse reporting, backup restore.

## Critical numerical acceptance criteria

- Subscriber count, total views and public video count are direct YouTube source numbers, displayed as they were supplied and never fabricated.
- BigInt values over JS `Number.MAX_SAFE_INTEGER` remain exact through DB, ranking and serialization.
- Null vs 0 are distinct. Unknown view count is null, not 0. Hidden subscriber metrics sort last and have `rank=null`.
- Equal reported subscriber counts produce equal rank. Stable ID tie ordering must not imply a measurement difference.
- `views.mean` uses only videos with a view-count value; if none, return null. Exposes denominator and sample limit.
- The latest-50 window is clearly called a sample, **not** a list of the creator's 50 highest-viewed videos.
- A failed refresh does not publish half-updated statistics or alter the prior published `syncRunId`.
- YouTube transient errors retry with bounded exponential backoff; authorization/quota errors are surfaced, not retried forever.
- One scheduler plus admin-triggered refresh cannot produce overlapping published runs.
- Periodic worker cleanup removes expired wall messages, and cache invalidation follows changes.

## Critical security acceptance criteria

- No credential or API key is embedded in frontend bundles or committed `.env` files.
- Admin password stored with Argon2id and TOTP secret encrypted at rest.
- Admin write without valid session and matching CSRF denied even if the request shape is valid.
- Every write endpoint enforces Owner/Editor/Moderator role **in API**, not merely disabled frontend buttons.
- Cross-origin state-changing requests are rejected; production uses HTTPS, a trusted reverse proxy and strict origin whitelist.
- Both guest and registered wall posts use authenticated sessions, flood/duplicate protection, blocked-term filter and retention.
- Guests and new accounts require successful Turnstile verification in production; dev bypass is rejected in production.
- Banned identities cannot post; moderator removal is broadcast in real time to connected wall clients.
- Redis dependency failure does not silently fail open for login or spam/rate limit controls.

## Commands

Native suite (works even without npm dependencies):

```bash
node --test tests/*.test.mjs
```

Full suite (after `npm install` and with a **non-production `_test` database**/Redis and `NODE_ENV=test` environment):

```bash
npm run build
npm test
npm run test:integration
```

Production data must not be used as an integration-test target. Never run test scripts against a production database.

## Release gates

- [ ] `npm run build` passes in a dependency-installed environment.
- [ ] All native unit tests pass.
- [ ] All API integration tests pass with PostgreSQL + Redis.
- [ ] Manual YouTube sync passes on verified small sample then 100 channels.
- [ ] MFA, CSRF, role protections tested from browser and API.
- [ ] Live wall two-client messaging and moderation verified.
- [ ] HTTPS proxy, Turnstile, SMTP and secret rotation policy configured.
- [ ] Database backup created and restore drill succeeds.
- [ ] External API and privacy/terms compliance reviewed before going public.


## Isolated integration database (mandatory)

Integration tests deliberately refuse to run unless `NODE_ENV=test` and the configured
PostgreSQL database ends with `_test`. In your development stack, create a disposable
`pci_test` database, apply the migration scripts against that database, and set
`DATABASE_URL=.../pci_test` in a temporary test-only `.env`. Never point the suite
at your real `pci` database. Run integration only after your source dependencies
have been installed and `npm run build` succeeds. The integration tests write and
remove a temporary guest wall message.
