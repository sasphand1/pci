# Module 2 interface architecture

```text
                    Pakistan Creator Index public site (Next.js)
                                 |
               +-----------------+-------------------+
               |                                     |
        Server rendered GETs                   Browser HTTPS/WS
        (ADAPTER_INTERNAL_URL)                (NEXT_PUBLIC_ADAPTER_API_URL)
               |                                     |
        Module 1 public API                  Module 1 wall auth/messages
               |                                     |
          Redis caching                      Socket.IO namespace /wall
               +-----------------+-------------------+
                                 |
                         Module 1 PostgreSQL
```

- **HTML/components**: all routes live in `src/app`, reusable data views in `src/components`. No inline styling.
- **Central UI**: workspace package `@pci/ui`, `packages/ui/src/styles.css` imports token/base/layout/components/responsive files in order. This is the theme Module 3 should also import.
- **Server fetching**: `src/lib/api.ts`; `cache:'no-store'`, 8s timeout, defensive fallback when backend is unavailable. Module 1 Redis remains authoritative cache.
- **Browser wall transport**: `src/lib/client-api.ts`; Socket.IO client connects to `/wall`; HTTP writes enforce backend validation and rate limiting; reconnect fetches recent messages.
- **Data integrity**: `src/lib/format.mjs` uses BigInt for precision with decimal-string counts, rejects absent or malformed metrics, does not assume uniqueness of cumulative subscribers.
- **Security**: no API key, admin session, or backend secret in frontend; no remote scripts except Turnstile. Source attribution and data scopes are disclosed.
- **Source-of-truth**: Module 1 owns definitions of ranks, aggregates, sample sizes and category associations. Module 2 never recomputes ranks.
- **API version**: `/api/v1`; any breaking backend contract change requires coordinated deployment or `/api/v2`.

## Interface compatibility with Module 1

- GET `/api/v1/overview`, `/status`, `/site-config`, `/categories`
- GET `/api/v1/creators`, `/creators/:slug`, `/creators/:slug/summary`, `/creators/:slug/videos`, `/rankings`
- GET `/api/v1/wall/messages`, `/wall/status`; POST `/wall/auth/guest`, `/wall/auth/register`, `/wall/auth/login`, `/wall/auth/logout`, `/wall/auth/verify-email`, `/wall/auth/forgot-password`, `/wall/auth/reset-password`, `/wall/reports`, `/wall/messages`
- DELETE `/api/v1/wall/auth/account`
- Socket.IO `/wall`: `wall:message_created`, `wall:message_removed`, `wall:status_changed`, `wall:presence`

## Backend setup mismatches to watch for

- `APP_PUBLIC_URL` for email links must be the Module 2 public origin. This site ships `/verify-email` and `/reset-password` redirect pages to match Module 1's mailer.
- Module 1 CSP is API-only; the public site config sets security headers but does **not** currently configure a strict nonce-based script CSP. Add that via a tested nonce/CSP implementation before internet launch, not with a naive CSP that breaks Next.js hydration/Turnstile.
- One browser connection != one unique user. Presence count from the backend must be labeled approximate.
- Frontend must never assume `thumbnailUrl`, count values, or timestamps are non-null.
