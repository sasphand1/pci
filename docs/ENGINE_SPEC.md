# PCI Engine Specification (clean-sheet design)

Status: decisions locked 2026-11-20. This document is the single contract for building the PCI ranking engine.
Scope of the first build: YouTube and Instagram. TikTok is reserved but disabled.
Existing code is out of scope until milestone M8 (alignment).

---

## 1. Purpose and principles

1. The admin curates a **bucket** of people. The engine ranks them. The website only displays published results.
2. Nobody owns a position. Positions are always computed from stored metrics.
3. Removing someone deletes them completely (hard delete). Nothing about them remains in any table.
4. Missing data is never treated as zero.
5. PostgreSQL is the only source of truth. There is no Redis.
6. A failed automated check never publishes a bad ranking. The previous ranking stays live and an alert is raised.
7. Every number shown on the site can be traced to a stored observation with a timestamp.

## 2. Vocabulary

| Term | Meaning |
|---|---|
| Bucket | The set of all people currently curated by the admin |
| Person | One individual (not a company, group or organization) |
| Account | One platform account (YouTube channel or Instagram profile) belonging to a person |
| Observation | One stored metric value for one account at one time |
| Scope | One ranking, for example `wheel.subscribed` or `youtube.subscribed` |
| Slot | One position in a scope's published ranking |
| Run | One execution of sync or rank |

## 3. Locked decisions

| # | Decision |
|---|---|
| D1 | TikTok is left out for now. The platform enum contains it, but no TikTok accounts can be added and no TikTok scope is published |
| D2 | All Instagram accounts are public Business or Creator accounts, read through the official Instagram Business Discovery API |
| D3 | A person may have zero or one account per platform (v1 rule). The same person may be on YouTube and Instagram. Linking is explicit, never guessed |
| D4 | The wheel sums follower **accounts** across a person's platforms. A human following on two platforms counts twice. The public label is "combined followers across platforms", never "unique audience" |
| D5 | Wheel sorts: Most Subscribed, Most Viewed, Most Active |
| D6 | Most Active = number of posts published in the last 30 days, summed across platforms |
| D7 | Most Viewed = YouTube lifetime channel views only (no comparable Instagram account metric exists). The label must say so |
| D8 | Facebook is out of scope |
| D9 | Restaurants and organizations are out of scope. The bucket contains individuals only |
| D10 | Daily automatic run at 09:00 Asia/Karachi, no human approval. Manual Sync, Rank and Publish are also available |
| D11 | Display sizes: wheel 12, platform rows 15 (configurable up to 20). The engine publishes the full ranked list; the API trims |

## 4. Admin workflows

### 4.1 Add (single or bulk)
- UI: one form with tabs **YouTube** and **Instagram** (TikTok tab present but disabled). Each tab has *single* and *bulk* mode.
- Bulk input: one line per row, `handle_or_url[, person[, niche]]`.
- Two steps: **validate**, then **commit**. Validation makes no changes and returns a status per row:
  `resolved`, `duplicate_in_bucket`, `duplicate_in_batch`, `invalid_format`, `not_found`, `unsupported_account_type`.
- Commit re-validates and inserts only rows that are `resolved`. It returns a per-row result. Partial success is allowed and reported.
- Linking: a row whose `person` value equals an existing person's slug or display name in the bucket, or another row in the same batch, attaches its account to that person. Anything else creates a new person. Names are never matched fuzzily.
- Adding never calls the full sync. It stores the account with no observations. The UI marks it "awaiting first sync".
- Limits: 200 rows per bulk request.

### 4.2 Remove (single or bulk)
- Hard delete in one transaction: the person and, through cascades, their accounts, observations, sync results, category links and slot rows.
- In the same transaction the engine re-ranks every scope **from stored observations only** (no external calls) and publishes. The person disappears from the site immediately.
- The audit log stores only action, actor, timestamp and counts. No handles or names.

### 4.3 Sync (manual)
- Fetches fresh metrics for all accounts (or one platform). Shows a result per account.
- Needed after additions. Not needed after removals.

### 4.4 Rank and Publish (manual)
- **Rank** builds a draft for every scope and shows a diff against the live ranking (who moved, who entered, who left).
- **Publish** promotes the drafts after the automated gates pass.
- **Run all** = sync, rank, publish in sequence.

### 4.5 Daily automatic run
- Same as Run all, triggered by the scheduler, no approval. If a gate fails, the live ranking stays and an alert is recorded.

## 5. Data model (PostgreSQL 16)

Implemented as SQL migrations. Names are normative.

```sql
CREATE TYPE platform AS ENUM ('youtube', 'instagram', 'tiktok');
CREATE TYPE metric AS ENUM ('followers', 'views', 'posts_30d');
CREATE TYPE accuracy AS ENUM ('exact', 'rounded3');
CREATE TYPE run_trigger AS ENUM ('manual', 'scheduled', 'system');
CREATE TYPE run_status AS ENUM ('queued', 'running', 'succeeded', 'partial', 'failed');
CREATE TYPE sync_outcome AS ENUM ('ok', 'not_found', 'private', 'rate_limited', 'unsupported', 'error');
CREATE TYPE rank_status AS ENUM ('draft', 'published', 'superseded', 'rejected');

CREATE TABLE people (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id   uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  platform    platform NOT NULL,
  external_id text NOT NULL,          -- YouTube channel ID, Instagram user ID
  handle      text NOT NULL,
  url         text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, external_id),
  UNIQUE (person_id, platform)
);

CREATE TABLE categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE,
  name       text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE person_categories (
  person_id   uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_primary  boolean NOT NULL DEFAULT false,
  PRIMARY KEY (person_id, category_id)
);
CREATE UNIQUE INDEX one_primary_category ON person_categories (person_id) WHERE is_primary;

CREATE TABLE sync_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger     run_trigger NOT NULL,
  platforms   platform[] NOT NULL,
  status      run_status NOT NULL DEFAULT 'queued',
  created_at  timestamptz NOT NULL DEFAULT now(),
  started_at  timestamptz,
  finished_at timestamptz,
  counts      jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE sync_results (
  run_id     uuid NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  outcome    sync_outcome NOT NULL,
  detail     text,
  PRIMARY KEY (run_id, account_id)
);

CREATE TABLE metric_observations (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  metric      metric NOT NULL,
  value       bigint NOT NULL CHECK (value >= 0),
  accuracy    accuracy NOT NULL DEFAULT 'exact',
  observed_at timestamptz NOT NULL,
  run_id      uuid REFERENCES sync_runs(id) ON DELETE SET NULL,
  UNIQUE (account_id, metric, run_id)
);
CREATE INDEX metric_latest_idx ON metric_observations (account_id, metric, observed_at DESC);

CREATE TABLE rank_runs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope          text NOT NULL,
  policy_version text NOT NULL,
  input_hash     text NOT NULL,
  status         rank_status NOT NULL DEFAULT 'draft',
  trigger        run_trigger NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  published_at   timestamptz,
  diagnostics    jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE rank_slots (
  run_id    uuid NOT NULL REFERENCES rank_runs(id) ON DELETE CASCADE,
  slot      integer NOT NULL CHECK (slot >= 1),
  rank      integer NOT NULL CHECK (rank >= 1),
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  value     bigint NOT NULL CHECK (value >= 0),
  breakdown jsonb NOT NULL,           -- per-account contributions and observed_at
  PRIMARY KEY (run_id, slot),
  UNIQUE (run_id, person_id)
);

CREATE TABLE published_pointers (
  scope  text PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES rank_runs(id) ON DELETE RESTRICT
);

CREATE TABLE admin_audit (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at      timestamptz NOT NULL DEFAULT now(),
  actor   text NOT NULL,
  action  text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'  -- counts and ids only, never names or handles
);
```

Admin authentication tables (users, TOTP secrets, sessions) are specified in the M1 task and follow the same rules: no plaintext secrets, encrypted TOTP, session expiry.

Rules:
- Every foreign key to `people` cascades, so a hard delete leaves nothing.
- Observations are append-only. They are never updated. They are removed only by cascade or retention.
- Retention: observations older than 90 days are deleted by a nightly job, per-platform configurable (YouTube API terms may require refresh or deletion of stored data; verify before launch).

## 6. Ranking policy v1

Policy lives in code, one pure function per scope, each with a version string stored on every rank run.

### 6.1 Scopes

| Scope | Policy version | Value per person |
|---|---|---|
| `wheel.subscribed` | `wheel.subscribed@v1` | sum of `followers` over the person's accounts |
| `wheel.viewed` | `wheel.viewed@v1` | sum of `views` over the person's accounts (effectively YouTube) |
| `wheel.active` | `wheel.active@v1` | sum of `posts_30d` over the person's accounts |
| `youtube.subscribed` | `youtube.subscribed@v1` | the person's YouTube `followers` |
| `instagram.followers` | `instagram.followers@v1` | the person's Instagram `followers` |
| `tiktok.*` | disabled | not published |

### 6.2 Layers (in order)

1. **Population**: all people in the bucket. Platform scopes keep only people with an account on that platform.
2. **Metric resolution**: for each account and needed metric, the latest observation no older than 7 days (adjustable). Otherwise the value is *missing*. Missing is never zero.
3. **Aggregation**: sum of valid values. The breakdown records each contributing account and its observation time, plus `counted` and `linked` account counts.
4. **Eligibility**: a person needs at least one valid value. Others are unranked with a recorded reason (`no_valid_value`).
5. **Ordering**: value descending; then largest single-account value descending; then `people.created_at` ascending; then `people.id`.
6. **Slots**: `slot` = position 1..N, unique. `rank` = 1 + number of people with a strictly greater value (competition ranking, equal values share a rank).
7. **Gates** (automated only, run before publish):
   - all values are non-negative integers;
   - every slot references an existing person, no duplicates, no gaps in `slot`;
   - coverage: at least 50% of the bucket (for that scope's population) has a valid value (adjustable);
   - input hash reproduces from the frozen input set.
   Large movements of individual people are never a reason to reject.
8. **Publish**: one transaction marks the draft `published`, the previous run `superseded`, and swaps `published_pointers`.

### 6.3 Display rules
- A card whose person has fewer counted than linked accounts shows "N of M accounts counted".
- Instagram and YouTube values carry their `accuracy` (YouTube subscriber counts are rounded to 3 significant figures; as far as known, verify).
- The site shows the publication time and a stale warning if the live ranking is older than 36 hours.
- Wheel label text is fixed by this spec: "Combined followers across platforms" / "YouTube lifetime views" / "Posts in the last 30 days".

## 7. Pipeline and jobs

- Job runner: `pg-boss`, backed by the same PostgreSQL. No Redis.
- Jobs: `sync.run` (singleton per platform), `rank.run`, `publish.run`, `pipeline.daily` (cron `0 9 * * *`, timezone `Asia/Karachi`), `retention.nightly`.
- Idempotency: a sync run for a platform is singleton while one is queued or running.
- Failure handling per account: one failure never blocks others. Each account gets a `sync_results` row.
- Retries: exponential backoff, maximum 3 attempts for `rate_limited` and `error`; none for `not_found`, `private`, `unsupported`.
- Recovery: a run stuck in `running` for more than 20 minutes is marked `failed` on worker start.
- Remove command: runs re-rank and publish synchronously inside the delete transaction.

## 8. Metric providers

Interface (conceptual):
```ts
interface Provider {
  platform: Platform;
  resolve(input: string): Promise<ResolvedAccount | ResolveError>;
  fetch(accounts: Account[]): AsyncIterable<FetchResult>; // one result per account
}
```
- **YouTube** (official Data API): resolve handle or URL to channel ID; fetch subscribers, lifetime views, recent uploads (to count `posts_30d`). Batch channel statistics (50 per request). Channel statistics must not depend on video retrieval succeeding.
- **Instagram** (official Business Discovery via the owner's connected business account): fetch followers and recent media with timestamps (to count `posts_30d`, capped by the page size; record when the cap was hit). Non-Business/Creator or private accounts return `unsupported`.
- **TikTok**: provider is a stub that returns `unsupported`. Not wired to any scope.
- Hidden or unavailable values produce no observation. They never become zero.
- API keys come from environment variables. Nothing secret is ever committed.

## 9. API surface (OpenAPI generated from Zod schemas, served at `/docs`)

Admin (authenticated, TOTP):
- `POST /admin/accounts/validate`, `POST /admin/accounts/commit`
- `DELETE /admin/people` (bulk, body of ids), `DELETE /admin/people/{id}`
- `PATCH /admin/people/{id}` (name, categories), `POST /admin/people/{id}/accounts` (link)
- `POST /admin/sync`, `GET /admin/sync/{id}`
- `POST /admin/rank`, `GET /admin/rank/{id}` (draft with diff), `POST /admin/rank/{id}/publish`
- `POST /admin/pipeline/run`, `GET /admin/status` (worker, last runs, coverage, unranked reasons)

Public (read-only, cacheable by ETag = publication id):
- `GET /v1/slots` (index of all scopes), `GET /v1/slots/{scope}`, `GET /v1/people/{slug}`
- `GET /health`

A test fails the build when any registered route is missing from the OpenAPI document.

## 10. Technology

| Layer | Choice |
|---|---|
| Language, layout | TypeScript, pnpm monorepo: `packages/core`, `packages/db`, `packages/providers`, `apps/api`, `apps/web`, `apps/admin` |
| API | Fastify, Zod type provider, `@fastify/swagger` and Swagger UI |
| Database | PostgreSQL 16, Drizzle ORM, SQL migrations (drizzle-kit) |
| Jobs | pg-boss |
| Frontend | Next.js (admin and public), shared UI package |
| Tests | Vitest, Testcontainers (real PostgreSQL), Playwright |
| CI | GitHub Actions with PostgreSQL service |
| Logging | pino, structured |
| Runtime | One Node container running API and worker; Next apps deployed separately |

Not used: Redis, microservices, a separate Python service, ML.

## 11. Roadmap and gates

A milestone is done only when its gate passes in CI against a real PostgreSQL.

| # | Milestone | Gate |
|---|---|---|
| M0 | Monorepo, CI, empty OpenAPI, migrations run on a fresh database | CI green |
| M1 | Bucket: schema, validate-then-commit add, hard delete, categories, audit, admin login | Tests in section 12 (A-series) |
| M2 | Providers and sync, per-account results, retries | Tests B-series, plus a live smoke test with 3 real YouTube accounts |
| M3 | Pure ranking core | Tests C-series |
| M4 | Rank, publish, gates, instant re-rank on delete, daily run | Tests D-series |
| M5 | Admin console (tabbed add forms, bucket table, Sync/Rank/Publish, diffs, status) | Staging walkthrough |
| M6 | Public site reading slots only, no fallbacks, stale label | Playwright E2E |
| M7 | Monitoring, alerts, backup and rollback drill, runbook, platform terms check | Rollback rehearsed |
| M8 | Alignment: load existing data, shadow comparison, cut over, retire old code | Differences explained |

## 12. Acceptance tests

**A (bucket)**
- A1: bulk validate of 120 rows containing duplicates, malformed handles and unknown accounts returns the correct status per row and changes nothing.
- A2: commit inserts only `resolved` rows and reports the rest.
- A3: two rows with the same `person` value link to one person; different names never link.
- A4: after deleting a person, a query across every table finds zero rows referencing that person's id.
- A5: a deleted account can be added again without a uniqueness error.
- A6: the audit log contains no handle or name after a delete.

**B (sync)**
- B1: with 5 of 50 mocked accounts failing, the other 45 have observations and the 5 have a `sync_results` row with the correct outcome.
- B2: a hidden subscriber count produces no observation (never zero).
- B3: a second `sync.run` while one is running is rejected or merged.
- B4: killing the worker mid-run, then restarting, marks the run `failed` and a new run completes.

**C (ranking core)**
- C1: hand-calculated fixtures for each scope match exactly.
- C2: shuffling the input order never changes the output.
- C3: adding or removing a person does not change any other person's value.
- C4: equal values share `rank` while `slot` stays unique (1, 1, 3 style).
- C5: an account with a 10-day-old observation is treated as missing; a person with only such accounts is unranked with a reason.

**D (publish)**
- D1: a draft that fails a gate leaves the live ranking unchanged and records an alert.
- D2: a single person moving from slot 40 to slot 1 does not block publish.
- D3: deleting a person updates every published scope in the same transaction, and the public API no longer returns them.
- D4: scenario: import 50, sync, rank, publish, add 20, sync, rank, publish, delete 10; all slots are consistent after every step.

## 13. Instructions for the implementing agent

1. Read this file completely. Do not change decisions in section 3 or policies in section 6. If something is ambiguous, stop and report it.
2. Work one milestone at a time. Do not start the next until the gate passes.
3. Prefer small commits. Never commit `.env` files or any secret. Use `.env.example` with empty values.
4. Every report must list changed files, migration ids, the exact commands run, and their real pass/fail output. A type-check alone is not evidence that a migration or API works.
5. Do not add features, services or dependencies not listed in section 10 without asking.