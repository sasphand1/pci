# Module Interface Contracts — V1

## Integration boundary

```
Module 2 Public Web ---- REST and Socket.IO ----> Module 1 Adapter
Module 3 Admin Panel ---- HTTPS REST / cookies ----> Module 1 Adapter
                                                    ├── PostgreSQL
                                                    ├── Redis
                                                    └── YouTube API (worker)
```

Public and admin clients **never** call PostgreSQL/Redis directly and **never** put the YouTube API key in browser code. Neither frontend can bypass Module 1 validation or permissions.

Base: `https://api.<your-domain>/api/v1`; all JSON requests use `Content-Type: application/json`.

## Public creator API

`GET /creators?page=1&limit=25&sort=subscribers&category=vloggers-influencers&search=duck`

```json
{
  "data": [
    {
      "id": "creator-uuid",
      "channelId": "UC......................",
      "slug": "example-creator",
      "displayName": "Example Creator",
      "subscriberCount": "2500000",
      "subscriberHidden": false,
      "viewCount": "900000000",
      "videoCount": "400",
      "fetchedAt": "2026-11-12T09:00:00.000Z",
      "rank": 1,
      "rankMetric": "subscribers",
      "categories": [{"slug":"vloggers-influencers","label":"Vloggers & Influencers"}]
    }
  ],
  "pagination": {"page":1,"limit":25,"total":100,"pages":4}
}
```

This is an illustrative response, **not real live statistics**. Count values are decimal strings for JavaScript precision. `subscriberCount`, `viewCount` and `videoCount` can be `null` when unavailable. Never coerce missing to zero. `rank=null` for unavailable chosen metric. Equal reported values share dense rank, with stable channel-ID ordering within ties.

`GET /creators/:slug/summary` returns `videosSampled`, `expectedMaxSample`, metric objects `views`, `likes`, and `comments` (each `{availableSamples,total,mean}`), `latestUploadedAt`, `statsFetchedAt`, and a source/sample-scope warning. Counts and means are decimal strings; unavailable means are null.

`GET /rankings?sort=subscribers|views|videos` sorts within the curated enabled channels (and optional filtered category). The category is editorial site navigation, not a classification supplied by YouTube.

`GET /status` and `GET /overview` expose publication timestamp; frontends should show an explicit **last refreshed** indicator, with a stale warning if older than their display threshold.

`GET /site-config` exposes only public allowed settings, never secrets. The default ranking selection is controlled through the admin app setting `ranking_default`.

## Admin security contract

1. Create first owner through the CLI, not a public signup endpoint.
2. `POST /admin/auth/login` with JSON `{ "email": "...", "password": "...", "totp": "123456" }`. On success the API sets an HttpOnly, SameSite=Strict `pci_admin` session cookie and returns `data.csrfToken`.
3. Admin browser calls must use `credentials: 'include'` and a permitted `ADMIN_ORIGIN`.
4. For every state-changing admin operation send `X-CSRF-Token: <csrfToken>`. The backend checks it and validates server-side roles.
5. `GET /admin/auth/me` retrieves identity and CSRF after page reload. Log out revokes Redis session; disabling admin increases session version and invalidates old sessions.
6. Roles: Owner = all; Editor = creators, categories, video/sync, selected settings read; Moderator = wall messages/reports/bans. Audit logs and security controls owner only.

Admin owner provisioning returns one-time password and TOTP URI. It must be displayed once over TLS and not stored by the admin frontend.

## Single shared Live Wall

**Guest:** `POST /wall/auth/guest` with `{ "nickname": "PakVisitor", "turnstileToken": "..." }` returns `data.token` (bearer). **Registered:** `POST /wall/auth/register` with `{ "email":"...","password":"...","nickname":"...","turnstileToken":"..." }`; verify email from SMTP link via `/verify-email`, then `/login` for bearer token. Both paths can `POST /wall/messages` using `Authorization: Bearer ...`.

`GET /wall/messages?limit=50` returns recent messages for **all creators and visitors in one room**. There are no per-creator chatrooms or YouTube comments.

Connect Socket.IO namespace `/wall`, with allowed public origin. Listen for `wall:message_created`, `wall:message_removed`, `wall:presence`, `wall:status_changed`. Only HTTP POST creates messages; socket clients cannot bypass spam checks by emitting arbitrary events. On reconnect, re-fetch the recent messages by REST.

The wall does **not** expose email addresses, IP addresses, or identity tokens in message broadcasts. Presence is approximate and counts socket connections, not verified unique people.

## Error format

```json
{"error":{"code":"VALIDATION_ERROR","message":"Invalid request"},"requestId":"request-uuid"}
```

Typical HTTP errors: `400` input, `401` unauthenticated, `403` unauthorized/bot/CSRF, `404` missing, `409` duplicate, `429` rate limiting, `503` missing upstream or disabled sync, `500` unexpected. API should never send stack traces to visitors.

## Module 2 and Module 3 responsibilities

The public website owns responsive UI, accessible navigation, SEO metadata, source attribution, creator profile visualizations and last-refreshed timestamps. The management app owns its views, workflow confirmations, MFA login UI, moderation queues and safe presentation of audit records. **All write logic, permission checks, math and validation remain in Module 1.**

## Contract evolution

Do not rename or remove existing `/api/v1` response fields. New nullable fields are permitted; breaking contract changes require `/api/v2` or explicit coordinated frontend releases. Any future custom Bayesian/ML ranking remains behind a policy approval review and a feature flag, with offline synthetic-data tests first.
