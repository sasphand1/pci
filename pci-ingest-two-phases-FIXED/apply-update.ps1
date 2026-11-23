# PCI Ingest updater v2 - contextual, transactional preflight. Run from PCI repo root.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Test-Path -LiteralPath 'Module_1_Adapter/package.json')) { throw 'Run this inside the PCI repository root.' }
$branch = (git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') { throw 'Switch to main before installing.' }

# Use exact string anchors rather than fragile line-number hunks.
$manifestPath = Join-Path $PSScriptRoot 'replacements.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
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

# Preflight: tracked target files must be clean and every old anchor must occur exactly once.
$dirtyLines = @(git status --porcelain -- $modified)
if ($LASTEXITCODE -ne 0 -or $dirtyLines.Count -gt 0) {
  throw "Tracked target files have local modifications; no files changed. $($dirtyLines -join '; ')"
}
$utf8 = New-Object System.Text.UTF8Encoding($false)
$planned = @{}
foreach ($path in $modified) {
  if (-not (Test-Path -LiteralPath $path)) { throw "Missing target file: $path" }
  $source = [System.IO.File]::ReadAllText((Join-Path (Get-Location).Path $path))
  $crlf = $source.Contains("`r`n")
  $normalized = $source.Replace("`r`n", "`n")
  $edits = @($manifest.PSObject.Properties[$path].Value)
  if ($edits.Count -eq 0) { throw "No edits defined for: $path" }
  foreach ($edit in $edits) {
    $old = [string]$edit.find
    $new = [string]$edit.replace
    if ([string]::IsNullOrEmpty($old)) { throw "Empty anchor in: $path" }
    $first = $normalized.IndexOf($old, [StringComparison]::Ordinal)
    if ($first -lt 0) {
      if ($normalized.IndexOf($new, [StringComparison]::Ordinal) -ge 0) {
        throw "File already partially patched: $path. No files changed."
      }
      throw "Repository changed around $path; cannot apply safely. No files changed."
    }
    if ($normalized.IndexOf($old, $first + $old.Length, [StringComparison]::Ordinal) -ge 0) {
      throw "Ambiguous matching anchor: $path. No files changed."
    }
    $normalized = $normalized.Replace($old, $new)
  }
  if ($crlf) { $normalized = $normalized.Replace("`n", "`r`n") }
  $planned[$path] = $normalized
}

foreach ($path in $added) {
  $src = Join-Path $PSScriptRoot $path
  if (-not (Test-Path -LiteralPath $src)) { throw "Missing package file: $path" }
  if (Test-Path -LiteralPath $path) {
    $candidateHash = (Get-FileHash -LiteralPath $src -Algorithm SHA256).Hash
    $existingHash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
    if ($existingHash -ne $candidateHash) { throw "Different existing file: $path. No files changed." }
    # Existing identical files are accepted (previous failed attempt).
    $tracked = @(git ls-files -- $path)
    if ($LASTEXITCODE -ne 0 -or $tracked.Count -gt 0) {
      throw "Target already tracked: $path. Do not double-install."
    }
  }
}

# All preflight checks passed. Take isolated backups in system temp for recovery.
$backupDir = Join-Path ([System.IO.Path]::GetTempPath()) ("pci-ingest-v2-"+[guid]::NewGuid().ToString('N'))
[System.IO.Directory]::CreateDirectory($backupDir) | Out-Null
$written = @()
$created = @()
try {
  foreach ($path in $modified) {
    $full = Join-Path (Get-Location).Path $path
    $key = ($path -replace '[\\/]', '__')
    [System.IO.File]::Copy($full, (Join-Path $backupDir $key), $false)
    $written += $path
    [System.IO.File]::WriteAllText($full, [string]$planned[$path], $utf8)
  }
  foreach ($path in $added) {
    if (-not (Test-Path -LiteralPath $path)) {
      $dir = Split-Path -Parent $path
      if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
      Copy-Item -LiteralPath (Join-Path $PSScriptRoot $path) -Destination $path -ErrorAction Stop
      $created += $path
    }
  }
} catch {
  foreach ($path in $written) {
    $key = ($path -replace '[\\/]', '__')
    Copy-Item -LiteralPath (Join-Path $backupDir $key) -Destination $path -Force
  }
  foreach ($path in $created) { Remove-Item -LiteralPath $path -Force }
  throw "Installation write failed; original files restored. $($_.Exception.Message)"
}
Write-Host "PCI Ingest files applied. Emergency backup: $backupDir"

# Full checks run in the actual repo. Never commit/push if any fail.
if (-not (Test-Path -LiteralPath 'Module_1_Adapter/node_modules')) {
  npm --prefix Module_1_Adapter ci
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed. Changes remain uncommitted; original backups retained.' }
}
npm --prefix Module_1_Adapter run check
if ($LASTEXITCODE -ne 0) { throw 'Module 1 build/tests failed. Changes remain uncommitted; original backups retained.' }

# Stage only the intended paths (other teams' untracked files are untouched).
git add -- @modified @added
if ($LASTEXITCODE -ne 0) { throw 'Staging failed. Nothing committed.' }
git commit -m 'PCI Ingest: central source observations and enrichment adapters'
if ($LASTEXITCODE -ne 0) { throw 'Commit failed. Changes remain local.' }
git push origin main
if ($LASTEXITCODE -ne 0) { throw 'Push failed. Commit is local; inspect remote before retry.' }
Write-Host 'PCI Ingest update applied, checked, committed and pushed.'
