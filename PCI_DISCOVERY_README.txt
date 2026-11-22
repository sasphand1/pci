PCI NETFLIX DISCOVERY ROWS — LOCAL-ONLY MODULE 2 PATCH (19 Nov 2026)

Extract this ZIP into C:\Users\sasph\Documents\PCI_Clean and overwrite matching files.
No GitHub, Hostinger, backend, token or database settings changed.

What changes:
- Original-inspired dark colorful category tiles (no more white category links).
- Filtering tiles immediately filter both the YouTube and Instagram carousels.
- YouTube row: TOP 20, sorted by reported YouTube subscribers.
- Instagram row: TOP 20, sorted by reported Instagram followers.
- Both fetch independently from /api/v1/unified/rankings?metric=subscribers&platform=...&limit=100, then apply the selected category and display up to 20.
- Only existing, admin-reviewed human YouTube people can be displayed; Instagram accounts must be linked to an approved human YouTuber and reviewed separately.
- Management panel already contains Instagram single and JSON bulk import with youtubeCreatorId, categoryIds and approval workflows. No admin migration needed for this UI-only change.
- TikTok horizontal placeholder; Restaurants and Events static placeholders without invented data.
- The existing Top 20 wheel, Top 100 table, stats, security and social APIs are unchanged.

Integration prerequisites:
1. Hostinger Module 1 must be healthy and serve /api/v1/unified/rankings endpoints.
2. Existing YouTube creators must be human-approved in /unified Admin page.
3. Instagram profiles must be imported through Admin /instagram, linked to youtubeCreatorId, reviewed, and synced using the existing Meta token configured on Module 1.
4. Only authentic reported counts appear; no seeded/fake profiles.

Validate (PowerShell):
  cd C:\Users\sasph\Documents\PCI_Clean\Module_2_Public_Website
  npm run typecheck
  npm run build

Then, in PCI_Clean root, stage only Module_2_Public_Website and commit/push manually after checking git diff.

Important: Category rail styling is restored based on approved visual screenshot but exact skyline background asset may not exist in current GitHub source; this update does not invent or overwrite that asset.
