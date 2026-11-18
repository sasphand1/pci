# PCI Instagram extension — backend-first

## What is included

- Module 1: migration `003_instagram_creators.sql`, protected creator register/bulk/review routes, read-only ranking endpoint, Business Discovery metrics collector, scheduled sync, history.
- Module 3: **Instagram creators** page with individual registration, bulk JSON import, category assignment, and human review.
- Module 2: **unchanged intentionally** until the new Instagram ranking endpoint is verified in your deployed environment.
- Existing YouTube ranking remains untouched. Instagram uses the same raw-count, deterministic, dense-rank approach (`compareCounts`) with platform-specific follower/post fields.

## Curator rule

Only an **individual human YouTuber** is eligible, not a company, brand, media organization, collective, generic channel, or business account representing a brand.

1. Add existing eligible human YouTuber to YouTube creator registry first.
2. In Instagram management, add the human's Instagram professional username (with optional categories), and link to the YouTube creator record.
3. Entries start **pending** and do not appear in public rankings.
4. Admin verifies evidence that both handles belong to the same individual and clicks **Approve human**. This records reviewer/time and a human attestation. Import never auto-approves.
5. Manual review is necessary: the Instagram API cannot determine real-person eligibility with certainty.

## Backend setup

1. Preserve all your existing env values. Add `INSTAGRAM_GRAPH_OWNER_ID`, `INSTAGRAM_GRAPH_ACCESS_TOKEN` and `INSTAGRAM_SYNC_ENABLED` from `Module_1_Adapter/.env.example` to your private `.env`.
2. Use a valid Meta Facebook Login Graph API token with the permissions tested for Business Discovery. Never put it in git, frontend or a screenshot. The token used in Graph Explorer is short-lived: obtain and rotate an appropriate production credential before unattended sync.
3. Set `INSTAGRAM_SYNC_ENABLED=true` only after verifying credential lifetime and approved profiles.
4. Execute normal Module 1 migration/deploy. Existing `migrate` will apply `003_instagram_creators.sql` once.
5. Start Module 1 API and worker, Module 3 admin panel. Add profiles from `/instagram` in the admin application.
6. Scheduler attempts Instagram refresh at 09:00 and 21:00 Asia/Karachi (manual refresh also available). No creator data is fetched until approved.

## API contracts

- `GET /api/v1/instagram/rankings?sort=followers|posts&page=1&limit=25&category=...` — approved humans only, ranked using reported official metric counts, missing values unranked.
- `GET /api/v1/admin/instagram/creators` — administrative registry and latest metrics.
- `POST /api/v1/admin/instagram/creators` — one new pending profile; body `{username,displayName,slug,biography?,youtubeCreatorId?,categoryIds?,enabled?}`.
- `POST /api/v1/admin/instagram/creators/bulk` — `{creators:[...]}`; 1–100 pending profiles, all-or-nothing transaction.
- `PATCH /api/v1/admin/instagram/creators/:id` — edit details or categories; username/link edits reset approval.
- `POST /api/v1/admin/instagram/creators/:id/review` — `{decision:"approved"|"rejected",humanAttested:boolean}`; approval requires human attestation **and a linked existing YouTube creator**.
- `POST /api/v1/admin/instagram/sync` — refresh approved profiles; owners/editors only.

The creator matching and approval are an editorial guarantee, **not** an automatic human-verification claim. Do not import Instagram companies simply because they have a public account.

## Example pending import

```json
{"creators":[{"username":"example.person","displayName":"Example Person","slug":"example-person","youtubeCreatorId":null,"categoryIds":[],"enabled":true}]}
```

Replace `youtubeCreatorId` with a valid YouTube creator UUID before approval. No sample creators were seeded.

## Tests / deployment caveats

- `cd Module_1_Adapter && npm test` — all 27 pure Node tests passed on the generated source.
- Full TypeScript compile, PostgreSQL integration and live Graph API calls have **not** been completed here: this runtime has no installed npm dependencies and offline `npm ci` could not fetch missing packages. Run the normal builds and end-to-end tests in your own Docker/network environment before deployment.
- The 12-hour job uses a single worker and is not a distributed queue; multi-instance deployments require a distributed lock/queue. Do not run multiple independent workers without coordination.
- Meta access, API rate limits, permission scope, business verification and token lifetime constrain which other professional accounts can be indexed. Failures retain last successful counts and are logged per profile.
- Instagram stats are not presented as the same measures as YouTube views or subscribers. Do not combine platform counts into an unsourced composite score.
