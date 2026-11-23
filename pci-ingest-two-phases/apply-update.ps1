# PCI Ingest Phase 1 + Phase 2 incremental update.
# Run from the EXISTING PCI repository root after extracting this package.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Test-Path 'Module_1_Adapter/package.json')) { throw 'Run this script from the existing PCI repository root.' }
$branch = (git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') { throw 'Checkout your PCI main branch before applying this update.' }

$modified = @(
  'Module_1_Adapter/.env.example',
  'Module_1_Adapter/src/server.ts',
  'Module_1_Adapter/src/worker.ts',
  'Module_1_Adapter/src/modules/creator-analytics/videos.ts',
  'Module_1_Adapter/src/modules/publish/pipeline.ts',
  'Module_1_Adapter/src/modules/publish/service.ts',
  'Module_1_Adapter/src/modules/sync/scheduler.ts'
)
$added = @(
  'Module_1_Adapter/database/migrations/103_ingest.sql',
  'Module_1_Adapter/docs/PCI_INGEST_TWO_PHASES.md',
  'Module_1_Adapter/src/lib/ingest-schema.ts',
  'Module_1_Adapter/src/modules/ingest/http.ts',
  'Module_1_Adapter/src/modules/ingest/pinned.ts',
  'Module_1_Adapter/src/modules/ingest/policy.ts',
  'Module_1_Adapter/src/modules/ingest/routes.ts',
  'Module_1_Adapter/src/modules/ingest/store.ts',
  'Module_1_Adapter/tests/unit/ingest-http.test.ts',
  'Module_1_Adapter/tests/unit/ingest-pinned.test.ts',
  'Module_1_Adapter/tests/unit/ingest-policy.test.ts'
)

# Preflight — do not override changes another PCI team made locally.
$dirty = @(git status --porcelain -- $modified)
if ($LASTEXITCODE -ne 0 -or $dirty.Count -gt 0) { throw "One of the 7 existing target files has local changes. Resolve them first.`n$($dirty -join "`n")" }
foreach ($path in $added) { if (Test-Path -LiteralPath $path) { throw "New target file already exists: $path. Stop to avoid overwriting a teammate's work." } }
$patch = Join-Path $PSScriptRoot 'integration.patch'
git apply --check -- $patch
if ($LASTEXITCODE -ne 0) { throw 'Integration patch no longer matches the current repository. No changes were applied.' }

# Apply ONLY reviewed file-level changes.
git apply -- $patch
if ($LASTEXITCODE -ne 0) { throw 'Patch failed; inspect git status.' }
foreach ($path in $added) {
  $src = Join-Path $PSScriptRoot $path
  $dir = Split-Path -Parent $path
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  Copy-Item -LiteralPath $src -Destination $path -ErrorAction Stop
}

# Full source tests are run in the target repo (they cannot run in the patch-only build environment).
if (-not (Test-Path 'Module_1_Adapter/node_modules')) {
  npm --prefix Module_1_Adapter ci
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation/build failed. Changes remain uncommitted.' }
}
npm --prefix Module_1_Adapter run check
if ($LASTEXITCODE -ne 0) { throw 'Full Module 1 build/tests failed. Changes remain uncommitted.' }

# Stage explicit files only. Do not bulk-stage other teams' work.
git add -- @modified @added
if ($LASTEXITCODE -ne 0) { throw 'Explicit file staging failed.' }
git commit -m 'PCI Ingest: centralized observations and public enrichment adapters'
if ($LASTEXITCODE -ne 0) { throw 'Commit failed; changes are still local.' }
git push origin main
if ($LASTEXITCODE -ne 0) { throw 'Push failed; commit remains local. Check remote history before retrying.' }
Write-Host 'PCI Ingest update applied, checked, committed and pushed.'
