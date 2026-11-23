param([Parameter(Mandatory=$false)][string]$Repo = 'C:\Users\sasph\Documents\PCI_Clean')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repo = (Resolve-Path -LiteralPath $Repo).Path
$kit = $PSScriptRoot
$manifest = Get-Content -LiteralPath (Join-Path $kit '_pci_wall_manifest.json') -Raw | ConvertFrom-Json
$items = @($manifest.files)
$paths = @(
'Module_1_Adapter/src/modules/wall/service.ts',
'Module_1_Adapter/src/modules/wall/links.ts',
'Module_1_Adapter/tests/unit/wall-links.test.ts',
'Module_2_Public_Website/src/app/robots.ts',
'Module_2_Public_Website/tests/security-indexing.test.mjs'
)
if ($items.Count -ne $paths.Count) { throw 'Unexpected ZIP manifest count.' }
Set-Location $repo
if ((git rev-parse --is-inside-work-tree) -ne 'true') { throw 'PCI repository not found.' }
git fetch origin main
if ($LASTEXITCODE -ne 0) { throw 'Git fetch failed.' }
$todo = @()
foreach ($i in $items) {
  if ($paths -cnotcontains $i.path) { throw "Unrecognized path $($i.path)" }
  $source = Join-Path $kit $i.path
  if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "File missing: $($i.path)" }
  $hash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($hash -ne $i.sha256) { throw "File integrity error: $($i.path)" }
  $current = (git rev-parse "origin/main:$($i.path)" 2>$null | Select-Object -First 1).Trim()
  if ($LASTEXITCODE -ne 0) { throw "Cannot inspect origin/main:$($i.path)" }
  if ($current -ne $i.baseGitSha -and $current -ne $i.newGitSha) {
    throw "Another PCI team changed $($i.path). Stopped safely; no changes committed."
  }
  if ($current -ne $i.newGitSha) { $todo += $i.path }
}
if ($todo.Count -eq 0) { Write-Host 'Wall hardening already present. No new commit.' -ForegroundColor Green; return }
$worktree = Join-Path $env:TEMP ('pci-wall-' + [guid]::NewGuid().ToString('N'))
git worktree add --detach $worktree origin/main
if ($LASTEXITCODE -ne 0) { throw 'Could not create isolated Git worktree.' }
$complete = $false
try {
  foreach ($i in $items) {
    if ($todo -cnotcontains $i.path) { continue }
    $destination = Join-Path $worktree $i.path
    Copy-Item -LiteralPath (Join-Path $kit $i.path) -Destination $destination -Force
  }
  Push-Location (Join-Path $worktree 'Module_1_Adapter')
  try {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'Backend npm ci failed; nothing pushed.' }
    npm run check
    if ($LASTEXITCODE -ne 0) { throw 'Backend full validation failed; nothing pushed.' }
  } finally { Pop-Location }
  Push-Location (Join-Path $worktree 'Module_2_Public_Website')
  try {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'Website npm ci failed; nothing pushed.' }
    npm run check
    if ($LASTEXITCODE -ne 0) { throw 'Website full validation failed; nothing pushed.' }
  } finally { Pop-Location }
  $exact = @($todo | ForEach-Object { ':(literal)' + $_ })
  git -C $worktree add -- $exact
  if ($LASTEXITCODE -ne 0) { throw 'Exact-file stage failed.' }
  git -C $worktree diff --cached --quiet
  if ($LASTEXITCODE -eq 0) { throw 'No files changed; please inspect package.' }
  if ($LASTEXITCODE -ne 1) { throw 'Git diff failed.' }
  git -C $worktree commit -m 'Harden Wall indexing and filter legacy public spam links'
  if ($LASTEXITCODE -ne 0) { throw 'Commit failed; nothing pushed.' }
  git -C $worktree push origin HEAD:main
  if ($LASTEXITCODE -ne 0) { throw "Push failed without force; worktree retained: $worktree" }
  $complete = $true
  Write-Host 'SUCCESS: PCI Wall indexing and public spam protection pushed.' -ForegroundColor Green
  Write-Host 'Redeploy Hostinger Module 1 AND Module 2, then run Verify-PCI-Wall.ps1.'
} finally {
  if ($complete) { git worktree remove $worktree | Out-Null }
  else { Write-Host "If a worktree was created, inspect it here: $worktree" }
}
