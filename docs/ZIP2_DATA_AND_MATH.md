# Zip 2: data in and the math

Metrics now flow into a history table, and the ranking math exists as pure code with tests.
Nothing is published and the public site is untouched.

## Files
NEW  Module_1_Adapter/database/migrations/093_observations.sql      refresh_runs, refresh_results, metric_observations
NEW  Module_1_Adapter/src/lib/observations-schema.ts               same DDL applied at startup (test keeps them identical)
NEW  Module_1_Adapter/src/providers/{types,map,youtube,instagram,tiktok,index}.ts
NEW  Module_1_Adapter/src/modules/refresh/{normalize,service,routes,retention}.ts
NEW  Module_1_Adapter/src/engine/{types,policy,resolve,aggregate,order,slots,hash,index}.ts   pure ranking core
NEW  Module_1_Adapter/scripts/live-smoke.mjs
NEW  Module_1_Adapter/tests/engine/ranking-core.test.ts, tests/fixtures/ranking-basic.json
NEW  Module_1_Adapter/tests/unit/{providers,providers-map,refresh-normalize,observations-schema}.test.ts
NEW  Module_1_Adapter/tests/integration/refresh.test.ts
NEW  docs/ZIP2_DATA_AND_MATH.md
MOD  Module_1_Adapter/src/server.ts                  mounts refresh routes, verifies observations schema
MOD  Module_1_Adapter/src/worker.ts                  verifies registry + observations schema
MOD  Module_1_Adapter/src/modules/sync/scheduler.ts  stalled-run recovery every 10 min, nightly retention 04:30 Karachi
MOD  Module_1_Adapter/src/modules/youtube/client.ts  adds uploadsPage (dated uploads)
MOD  Module_1_Adapter/package.json                   test also runs tests/engine; test:db runs both DB files; smoke:live
MOD  .github/workflows/ci.yml                        database tests now run bucket + refresh, one file at a time

## Run
    cd Module_1_Adapter
    npm install && npm run build && npm test
    npm run migrate          # applies 093 (also applied automatically at startup)
    npm run smoke:live -- yt:@somehandle yt:UCxxxxxxxxxxxxxxxxxxxxxx ig:someusername     # real values, writes nothing

## API (admin session + CSRF)
POST /admin/refresh   {platforms?: ["youtube","instagram"]}   owner, editor   returns 202 and one run per platform
GET  /admin/refresh                                            latest runs
GET  /admin/refresh/:id                                        run, outcome counts, one row per account

## Rules implemented
- One run per platform; a second request while one is queued or running returns the existing run (database-enforced).
- Every account gets exactly one result row: ok, hidden, not_found, private, rate_limited, unsupported or error.
- rate_limited and error are retried up to 3 attempts with 1s, 2s backoff; the others are final.
- Hidden or invalid values create no observation. Nothing is ever stored as zero because it was missing. A real 0 is stored.
- YouTube: channel statistics (50 per request) are independent of the uploads lookup. posts_30d pages the uploads playlist until an upload older than 30 days, max 4 pages; the cap is recorded (`capped`).
- Instagram: followers plus the 50 newest media for posts_30d; cap recorded; non-Business/private/missing all return unsupported.
- A run with no heartbeat for 20 minutes is marked failed (on every refresh start, every 10 minutes, and at worker start).
- Instagram accounts imported as `pending:<username>` get their real id on the first successful fetch.
- Retention: observations older than 90 days are deleted nightly (PCI_RETENTION_DAYS_YOUTUBE / PCI_RETENTION_DAYS_INSTAGRAM, minimum 8). Rankings only read the last 7 days.
- Deleting a person removes their observations and results (cascade). A run in flight skips accounts deleted meanwhile.

## Ranking core (src/engine, no database/network/cache imports)
Layers: population, latest observation <= 7 days (older = missing, no fallback), sum, eligibility, order
(value desc, largest single account desc, created_at asc, id asc), slot (unique) and rank (competition: 1,1,3), input hash.
Scopes: wheel.subscribed, wheel.viewed, wheel.active, youtube.subscribed, instagram.followers, category.<slug>.
"N of M accounts counted": M is the person's accounts on platforms that can supply that metric (views: YouTube only).
Two unranked reasons: no_valid_value, and no_supported_account (e.g. an Instagram-only person in wheel.viewed); the latter is not counted in the population for coverage.

## Fixture arithmetic (tests/fixtures/ranking-basic.json), calculated by hand, not by the code
now = 2026-11-20 12:00 UTC. Stale = older than 7 days (p5's data is 10 days old, p6's Instagram data 8 days old).
wheel.subscribed: p1 1000+500=1500, p2 1200, p3 1500, p4 1000+500=1500, p5 stale -> unranked, p6 900 (Instagram 600 stale, "1 of 2").
  Tie at 1500: largest single account p3 1500 > p1 1000 = p4 1000; then created_at p1 before p4. Order p3, p1, p4, p2, p6. Ranks 1,1,1,4,5.
wheel.viewed (YouTube only): p4 70000, p1 50000, p2 20000, p6 5000; p3 has no YouTube (no_supported_account), p5 stale.
wheel.active: p1 4+10=14, p3 10, p6 6 (Instagram 9 stale), p4 3+0=3 (zero is real), p2 2, p5 stale.
youtube.subscribed: p2 1200, p1 1000, p4 1000 (tie -> created_at), p6 900, p5 stale. Ranks 1,2,2,4.
instagram.followers: p3 1500, p1 500, p4 500, p6 stale. Ranks 1,2,2.
category.gamer: p1 1500, p2 1200. category.cook: p3 1500, p4 1500 (p3 first: larger single account), both rank 1.
Please read these once: if a rule is wrong, the fixture is wrong too.

## Not verified here (no PostgreSQL, no package installs, no live APIs in my sandbox)
Run here: 82 unit and engine tests pass (with Zip 1's), strict type-check passes for the engine, mappers, Instagram and TikTok providers
and normalize.ts, and 16 deliberate code breakages were all caught by the tests.
Not run here: full `npm run build`, the database tests (B1 to B4 and more, in tests/integration/refresh.test.ts), and any real YouTube/Instagram call.
That is what CI and `smoke:live` are for.
