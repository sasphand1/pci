# Module 2 testing plan and evidence

## Already testable without npm dependencies

- All TS/TSX syntax is parsed using local TypeScript compiler (report in `docs/BUILD_STATUS.md`).
- `npm test` verifies central CSS rule, required routes/contracts, no inline styles, formatting of large integer counts and thumbnail hostname restrictions.

## Run on Windows with Module 1 started

1. `docker compose up -d --build` for Module 1, migrate DB, create Owner, import creator records, trigger a successful sync.
2. `npm install` then `npm run typecheck && npm test && npm run build` for Module 2.
3. Open homepage at 3000 and verify real snapshot date and counts; no fake data.
4. Directory search + sort by subscribers/views/videos; check ties/hidden values against Module 1 response.
5. Profile for a creator: check 50-video upper bound, null likes/comments shown as Unavailable, sample note visible.
6. Categories, compare two creators, recent videos, bad creator slug, empty/failed API states.
7. Create guest with valid Turnstile token; in two browser windows test socket fanout and reconnect; attempt too-fast and duplicate sends (backend 429).
8. Register member, receive email verification, login; logout, refresh; recovery and account deletion flow. Verify email deep links from Module 1.
9. Report message, remove in Admin (Module 3 once built), verify deletion event on open clients.
10. Run mobile widths 320, 375, 768, 1280 with keyboard and screen reader focus/navigation.
11. Disable Redis/API temporarily; verify graceful fallback and meaningful user-visible errors.
12. Deploy behind HTTPS; set origins, TURNSTILE_SECRET_KEY, production hostname, SMTP, privacy/operator details; perform dependency vulnerability scan and configure tested CSP.

## Known unverified checks in this environment

- `npm install`, Next.js compilation and runtime integration were not runnable due to npm registry DNS errors.
- External API, Docker, SMTP and WebSocket two-client integration not run here.
- No claim of production certification. Do not deploy publicly until this plan passes.
