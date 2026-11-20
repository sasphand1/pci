# Zip 1: foundation and bucket

Adds the registry (people, accounts, categories per person), the admin bucket API
(preview, add, change niche, hard delete), a backfill command for existing data, tests, and CI.
The public site and the old ranking code are untouched.

## Files
NEW  .github/workflows/ci.yml
NEW  docs/ZIP1_FOUNDATION.md
NEW  Module_1_Adapter/.env.test.example
NEW  Module_1_Adapter/database/migrations/092_registry.sql
NEW  Module_1_Adapter/src/lib/registry-schema.ts
NEW  Module_1_Adapter/src/modules/bucket/{parse,classify,resolver,service,routes,backfill-plan}.ts
NEW  Module_1_Adapter/src/cli/backfill-registry.ts
NEW  Module_1_Adapter/tests/unit/{bucket-parse,bucket-classify,backfill-plan,registry-schema}.test.ts
NEW  Module_1_Adapter/tests/integration/bucket.test.ts
MOD  Module_1_Adapter/src/server.ts            (mounts bucket routes, verifies registry schema at startup)
MOD  Module_1_Adapter/src/modules/youtube/client.ts  (adds channelByHandle)
MOD  Module_1_Adapter/package.json             (test now also runs tests/unit; adds test:db, backfill:registry)
DEL  Module_2_Public_Website/.github/          (inert there; the real workflow is now at the repo root)

Delete command (PowerShell, from repo root):  Remove-Item -Recurse -Force Module_2_Public_Website\.github

## Run
    cd Module_1_Adapter
    npm install
    npm run build
    npm test                 # existing tests + 33 new unit tests
    npm run migrate          # applies 092 (also applied automatically at startup)
    npm run backfill:registry            # dry run, prints a report, writes nothing
    npm run backfill:registry -- --apply # imports legacy creators

Database tests: copy .env.test.example to .env.test, point DATABASE_URL at a *_test database, then `npm run test:db`.

## API (admin session + CSRF, same as the rest of /api/v1/admin)
GET    /bucket?platform=&q=&limit=&offset=      any admin
POST   /bucket/preview   {platform, text}        owner, editor  (writes nothing)
POST   /bucket/people    {platform, text}        owner, editor
PUT    /bucket/people/:id/categories {categories:[slug], primary}   owner, editor
DELETE /bucket/people/:id                        owner only

`text` is one line per account: `handle_or_link[, person name[, category slug]]`. Max 200 lines.
Single add is one line. A person name links to an existing person only on an exact match (ignoring case/spacing/accents);
without a typed name nothing is ever linked automatically.

## Decisions to know about
- platform is text with a CHECK (not an enum) so the migration can be re-run safely.
- Legacy YouTube/Instagram rows linked by backfill are deleted together with the person. Old approval status is not used; rejected and disabled legacy rows are not imported.
- Instagram accounts with no stored provider id import as `pending:<username>` and are reported; Zip 2 resolves them.
- If a person already has an account in the registry, backfill skips that whole person on re-run.
- Instagram cannot tell "missing" from "private" from "not Business/Creator"; all show as unsupported_account_type.

## Not verified here (no PostgreSQL, no installs in my sandbox)
The 33 unit tests ran and pass; the pure modules pass strict `tsc`. Not run here: full `npm run build` (type-check of service/routes/server), the database tests, and live YouTube/Instagram lookups.
One existing test, "production secrets are not hardcoded in env template", needs `.env.example`, which was missing from my snapshot; it passes in your repo if the file is there.
CI runs build + tests + migrations + database tests on every push. Only Module 1 is in CI for now; Modules 2 and 3 are added in Zip 4.
