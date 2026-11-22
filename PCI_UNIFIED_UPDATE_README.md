# PCI: YouTube + Instagram unified creator system — additive update

This is a ZIP overlay for your local `PCI_Clean` project. **No GitHub modifications are performed by this package.**

## What is included
- Layer 1: Existing YouTube and Instagram API adapters unchanged; TikTok intentionally not implemented.
- Layer 2: New human-only review state for YouTube people in an additive SQL migration.
- Layer 3: Pure deterministic `unified/metrics.mjs` normalization/ranking layer, with tests and TypeScript declaration.
- Layer 4: Public `/api/v1/unified/rankings` and `/api/v1/unified/overview` routes. Counts are strings so BigInt precision is retained.
- Layer 5: Admin `/admin/unified/creators` and `/admin/unified/creators/:id/review` routes, plus human review/category screen.
- Layer 6: Existing wheel CSS classes reused for a 20-person wheel with three switches. White Top 100 table with YouTube/Instagram brand-style SVG links and separate platform/metric filters. Existing category URLs retained; linked accounts use the same human's categories. Three independent overview filters.

## IMPORTANT metric definitions
- **Most Subscribed**: YouTube subscribers + Instagram followers, if known, at the level of ONE real person. It is *not unique audience reach*, because followers may overlap. Missing counts are omitted; they're never assumed to be zero.
- **Most Viewed**: verified lifetime YouTube channel view count ONLY. Business Discovery follower/media counts are *not* video views and cannot be added as if they were.
- **Most Active**: YouTube lifetime videos + Instagram lifetime posts (content volume, not recent posting frequency).
- TikTok is a **disabled placeholder**, never fabricated.
- A given human always appears as one row, even when YouTube and Instagram are both linked.
- Only manually approved **individual human YouTubers** qualify for the unified public lists; legacy YouTube lists and API remain in place for audit/rollback.

## Install on Windows PowerShell
1. Commit or back up your local work first.
2. Extract this ZIP directly into `C:\Users\sasph\Documents\PCI_Clean` and allow the included file replacements. The ZIP has no `.env` or secret files.
3. In PowerShell, from project root, run:
   `powershell -ExecutionPolicy Bypass -File .\APPLY_PCI_UNIFIED_UPDATE.ps1`
   This adds the route mounts and nav/style imports in place, idempotently. It never contacts GitHub.
4. Backend tests: `cd Module_1_Adapter; npm test; npm run build; cd ..`
5. Frontend: `cd Module_2_Public_Website; npm run typecheck; npm run build; cd ..`
6. Admin: `cd Module_3_Admin_Panel; npm run build; cd ..`
7. Check `git diff --check` and review the commit diff. Then stage only the three module directories and commit/push yourself.
8. **Run the database migration in your actual backend deployment** (`npm run migrate` or your existing migration procedure). Do this before expecting `/api/v1/unified/*` endpoints to work. The Hostinger public website deployment alone does NOT apply backend SQL migrations or restart a separate API server.
9. Open Module 3 **Unified human review**; approve verified persons. Everyone starts pending. Existing YouTube-only creators will not appear in the new human-only ranking until verified.
10. Set the browser-facing `NEXT_PUBLIC_ADAPTER_API_URL` to the existing public backend origin (same as other Module 2 API usage) for client-side platform filtering. No tokens in browser env vars.

## Compatibility limitations / validation
- The new files were generated against GitHub files inspected in this conversation, but the full project could not be built here (no npm network/dependencies available). The pure ranking tests passed. **Do not assume production is ready until all three module builds and API smoke tests pass locally.**
- The use of the existing review workflow is deliberately conservative; it will initially display an empty unified leaderboard until real individual human YouTubers are explicitly approved.
- Instagram account linking remains required before its counts are merged. The verified Meta collector is not replaced.
- Existing separate YouTube pages, platform rows and Live Wall are preserved as files; the homepage presents the new unified arrangement.
- If a backend/API origin cannot be reached, the frontend shows an empty state rather than fictitious rankings.
