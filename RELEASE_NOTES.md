# PCI Unified Top 10 — Prototype Update

## What changes
- Module 1: experimental cross-platform normalized rank aggregation, curation endpoints, migration 004, 20-person pool, precise ties, default public endpoint disabled.
- Module 2: independent YouTube and Instagram Top 10 rows; unified research wheel when explicitly enabled; shared tied-rank cards with split crown and creator profile links. The public homepage falls back to the existing YouTube wheel while the research feature is disabled.
- Module 3: administrator candidate curation and experimental ranking preview.
- FORMULAE_AND_RANKING_METHODS.md: all ranking formulae, assumptions and limitations.

## Installation
1. Back up all existing modules and database before applying.
2. Overlay the three module directories onto the corresponding modules, preserving your own .env files. Do NOT replace database or secrets.
3. Run migration Module_1_Adapter/database/migrations/004_cross_platform_curated.sql on your already migrated PostgreSQL database, **after 003**.
4. Install dependencies per module (`npm ci`), run `npm test`, `npm run typecheck` as applicable, and `npm run build` locally.
5. Leave CROSS_PLATFORM_PUBLIC_ENABLED unset/false until compliance and accuracy review; admin preview is available separately.
6. Verify real Instagram and YouTube statistics are fetched and link matching is correct in the admin panel.

## Validation and safety
Unit tests for module 1 and module 2 pass locally. Admin tests pass after adapting the existing shared UI test to accommodate the pre-existing Hostinger mirror. Full Next.js/TypeScript builds and live database migration were **not verified** in this environment due to missing installed build dependencies. Treat this as a testable candidate, not a production-certified release.

Never publish custom YouTube-derived composite ranking without checking YouTube API policies/permissions. Existing raw-metric rankings remain supported.
