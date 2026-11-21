# Zip 4: public site, API docs, comparison and cutover

**Apply Zip 3 first.** Extract this zip onto the repo root (overwrite), then commit with the exact-path command at the bottom.

## What changed
- **Public API** `/api/v1/public`: status, wheel (3 sorts, 12 cards), rows (YouTube, Instagram, one per category, 15 each), any one ranking (up to 100), categories, people directory, one person. All read only from published rankings. A draft is never visible. A picture link is shown only if it is on a known YouTube image host.
- **API docs** at `/docs` (Swagger UI) and `/api/v1/openapi.json`. The router and the document come from one list, so a route cannot exist undocumented and the server refuses to start if they disagree.
- **Public website** (Module 2): home (wheel, platform and category rows, Top 100), Top 100 page, categories, creator directory, profile, compare, methodology rewritten to the real rules. `/videos` now redirects to the directory.
- **Pictures:** the refresh stores the link to each YouTube channel's picture (migration 095, one text column). Instagram people show a letter.
- **Compare with the old site** (Pipeline screen, read-only): old YouTube ranking next to the new one.
- **Retiring the old system without deleting it:** old public ranking endpoints answer 410 and the old sync stays off unless you set `PCI_LEGACY_PUBLIC=true` / `PCI_LEGACY_SYNC=true`. That is the rollback.
- **CI** now also type-checks, tests and builds Module 2 and Module 3.
- **Runbook:** `docs/RUNBOOK.md` (variables, cutover steps, daily care, what to do when something fails).

## Verified here
130 Module 1 unit and engine tests, 31 Module 2 tests, 21 Module 3 tests; strict type-check of the pure API modules; syntax check of every other changed file; mutation checks (see below); a check that no reachable page calls an old endpoint.

## Not verified here (CI must confirm)
Module 1 full build and database tests (including `public.test.ts`), Module 2 and Module 3 `typecheck` and `next build`, Swagger UI loading from unpkg (pinned 5.17.14, no integrity hash), live API calls.

## Decisions you may want to change
- Old video lists and creator-level video statistics are gone from the public site (they came from the old tables).
- Wheel cards are slots 1 to 12; a tie shows the same rank with an equals sign.
- Old code is switched off, not deleted. Delete it after a week without needing the rollback.

## After the cutover week: safe deletions in Module 2
These files are no longer imported by anything (checked, and all Module 2 tests pass without them):
```powershell
git rm Module_2_Public_Website/src/components/RankingWheel.tsx Module_2_Public_Website/src/components/UnifiedWheel.tsx Module_2_Public_Website/src/components/UnifiedCreatorExperience.tsx Module_2_Public_Website/src/components/CreatorDiscoveryRows.tsx Module_2_Public_Website/src/components/CategoryRails.tsx Module_2_Public_Website/src/components/PlatformTopRows.tsx Module_2_Public_Website/src/components/HomeLeaderboard.tsx Module_2_Public_Website/src/components/ComparisonPicker.tsx Module_2_Public_Website/src/components/DirectoryFilters.tsx
```
Old Module 1 and Module 3 code is left for a later cleanup once the rollback switches are no longer needed.

## Commit exactly these files (no clutter)
`git add -u` skips new files and `git add -A` picks up every leftover script. This adds exactly what is in the zip (change the path if the zip is elsewhere):
```powershell
cd "C:\Users\sasph\Documents\PCI_Clean"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = "$HOME\Downloads\PCI_Zip4_Public_Site_And_Cutover.zip"
$files = [IO.Compression.ZipFile]::OpenRead($zip).Entries | Where-Object { $_.Name } | ForEach-Object { $_.FullName }
git add -- $files
git diff --cached --name-only
```
Check the list shows only paths from the zip, then `git commit -m "PCI Zip 4: public site, API docs, cutover"` and `git push origin main`.
