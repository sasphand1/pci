# Zip 3: Publish and Admin Console

Extract onto the repo root (overwrite). Then run the DB tests in CI as before.

## What it does
- **Rank** builds a draft ranking per scope (3 wheel scopes, YouTube row, Instagram row, one per category). Nothing is public.
- **Publish** checks each draft against safety gates inside one transaction. Passing drafts go live; failing drafts are marked rejected, an alert is raised, and the live ranking is untouched.
- Gates: policy version, non-negative integers (value equals sum of contributions), unique people, valid references, slots 1..N without gaps, ranks consistent with value order, coverage of at least 50% (`PCI_MIN_COVERAGE`), input hash reproduces. Large movements never block.
- **Rollback** restores the latest superseded run for a scope if it is still valid (refused if it contains a deleted person).
- **Hard delete** removes the person everywhere (cascade), removes them from every live ranking, closes slots and ranks up, leaves everyone else's values unchanged, and publishes that as a `system` run.
- **Daily pipeline** (Refresh, Rank, Publish) at 09:00 Asia/Karachi, no approval. Off with `PCI_PIPELINE_DAILY=false`. One pipeline at a time (DB unique index; stuck runs over 60 min are recovered). A failed refresh does not block ranking: freshness (7 days) and coverage decide.
- Nightly retention at 04:30 plus pruning of old rank runs.

## Files
Module 1: migration `094_publication.sql`, `publication-schema.ts`, `engine/remove.ts`, `modules/publish/{gates,diff,service,pipeline,status,routes}.ts`; modified `bucket/service.ts`, `server.ts`, `worker.ts`, `sync/scheduler.ts`, `engine/index.ts`, `package.json`, CI workflow; tests `publish-gates`, `publication-schema`, `integration/publish`.
Module 3: `app/bucket/page.tsx`, `app/pipeline/page.tsx`, `lib/{api,types,nav}.ts`, `tests/bucket-ui.test.mjs`.

## Endpoints (admin session, writes need CSRF)
POST /admin/rank, GET /admin/rank/latest, GET /admin/rank/:batchId, POST /admin/rank/:batchId/publish, POST /admin/pipeline/run, GET /admin/pipeline/status, POST /admin/pipeline/alerts/:id/ack, GET /admin/publications, GET /admin/publications/:scope, POST /admin/publications/:scope/rollback.

## Deviation
Status is at `/admin/pipeline/status` because `/admin/engine/status` already exists.

## Verified here
102 Module 1 unit/engine tests, 20 Module 3 structure tests, mutation checks on gates, slot closing and the value-order check (one survivor found and fixed with a new test), strict type-check of pure modules, syntax check of all other files.

## Not verified here (needs CI)
Full TypeScript build, all DB integration tests (`npm run test:db`, concurrency 1), live YouTube/Instagram calls, Module 3 type-check and `next build`.

## Navigation
Bucket and Pipeline replace the old creator, unified, Instagram, sync and ranking entries. Old page files remain until the cutover in Zip 4.
