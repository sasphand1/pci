# PCI Solid Reliability Update — guarded release candidate

This release applies to the EXISTING `C:\Users\sasph\Documents\PCI_Clean` checkout. It never writes to GitHub.

## Included (exactly nine files)

- `Module_1_Adapter/src/modules/admin/routes.ts` — batch imports enqueue an initial sync in the same transaction as newly inserted/restored creators.
- `Module_1_Adapter/src/worker.ts` — on worker startup, queue a backfill if enabled YouTube creators have no channel snapshots.
- `Module_1_Adapter/src/modules/sync/service.ts` — valid channel snapshots commit before optional video collection; partial channel API responses do not discard the successful channel responses. Video fetch failures do not wipe prior videos.
- `Module_1_Adapter/src/modules/unified/routes.ts` — split the fragile unified multi-join into core creator/categories and optional Instagram reads; an optional missing Instagram relation/column does not crash YouTube unified rankings. Other SQL errors still return 500 and must be diagnosed.
- `Module_1_Adapter/tests/pci-solid-reliability.test.mjs` — new ranking invariants and sync wiring guards.
- `Module_2_Public_Website/src/components/UnifiedCreatorExperience.tsx` — wheel shows ONLY Most Viewed, Most Subscribed, Most Active, default Most Viewed.
- `Module_2_Public_Website/src/app/page.tsx` — no unused all-rounders request.
- `Module_2_Public_Website/tests/premium-home.test.mjs` and `tests/sleek-navigation.test.mjs` — align regression assertions with the three-choice wheel.

No new database migration, new dependency, or direct creator record modification.

## Apply — PowerShell

```powershell
$ErrorActionPreference = 'Stop'
$zip = Join-Path $HOME 'Downloads\PCI_Solid_Reliability_Update.zip'
$dest = Join-Path $HOME 'Documents\PCI_Solid_Reliability_Update'
if (!(Test-Path $zip)) { throw "ZIP not found: $zip. Adjust the path to your downloaded ZIP." }
Expand-Archive -LiteralPath $zip -DestinationPath $dest -Force
cd 'C:\Users\sasph\Documents\PCI_Clean'
node (Join-Path $dest 'APPLY_PCI_SOLID.mjs') --dry-run
if ($LASTEXITCODE -ne 0) { throw 'Dry run failed' }
node (Join-Path $dest 'APPLY_PCI_SOLID.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Patch failed' }
```

## Validate — STOP on failure

```powershell
cd 'C:\Users\sasph\Documents\PCI_Clean\Module_1_Adapter'
npm test
if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Backend build failed' }
cd ..\Module_2_Public_Website
npm run check
if ($LASTEXITCODE -ne 0) { throw 'Public site validation failed' }
cd ..\Module_3_Admin_Panel
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Admin typecheck failed' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Admin build failed' }
```

## Stage, commit and push — ONLY after checks pass

```powershell
cd 'C:\Users\sasph\Documents\PCI_Clean'
git add Module_1_Adapter/src/modules/admin/routes.ts
git add Module_1_Adapter/src/modules/sync/service.ts
git add Module_1_Adapter/src/modules/unified/routes.ts
git add Module_1_Adapter/src/worker.ts
git add Module_1_Adapter/tests/pci-solid-reliability.test.mjs
git add Module_2_Public_Website/src/components/UnifiedCreatorExperience.tsx
git add Module_2_Public_Website/src/app/page.tsx
git add Module_2_Public_Website/tests/premium-home.test.mjs
git add Module_2_Public_Website/tests/sleek-navigation.test.mjs
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Git whitespace check failed' }
git diff --cached --stat
# Verify exactly nine intended files are staged.
git commit -m 'Stabilize PCI sync and unified rankings; restore three wheel metrics'
if ($LASTEXITCODE -ne 0) { throw 'Commit failed' }
git push origin main
```

## Production verification

1. Module 1 must deploy with its worker process, and `YOUTUBE_SYNC_ENABLED=true`; otherwise queued jobs do not run.
2. Check `/health/ready` and `/api/v1/unified/rankings?metric=subscribers&platform=all&limit=100` — HTTP 200 required. If 500 persists, capture the backend `[PCI_API_FAILURE]` SQLSTATE/request ID instead of guessing.
3. Check `/api/v1/rankings?sort=subscribers&limit=100` coverage after worker processing. Only channels with real subscriber statistics receive ranking positions; 49 imported identities are not automatically 49 ranked channels.
4. Review human eligibility: the unified wheel is still restricted to explicitly approved people. This patch does NOT bulk approve pending identities or merge group/brand accounts into individual-human rankings.
5. Verify the wheel has exactly three metric options, and site platform rows remain platform-only.
6. Test deletion/reimport on staging before production bulk purges.

## Engineering limits

Verified here: Node installer syntax, clean-fixture dry run, clean-fixture application, repeat-application idempotence, and TypeScript syntax transcription of the changed code. NOT verified here: full project typechecking, live PostgreSQL schema, production worker health, or all runtime API responses. This is a release candidate until the checks above pass.

The installer creates a `.pci-solid-backup-<timestamp>` directory inside the checkout for rollback. Never stage backups or unrelated legacy patch scripts with `git add .`.
