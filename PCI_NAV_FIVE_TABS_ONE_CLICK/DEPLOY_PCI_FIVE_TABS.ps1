param(
  [string]$RepoRoot = (Get-Location).Path
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Run-Checked([string]$Command, [string[]]$Arguments) {
  Write-Host "`n> $Command $($Arguments -join ' ')" -ForegroundColor DarkCyan
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Command exited with status $LASTEXITCODE" }
}

try {
  $RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
  Set-Location -LiteralPath $RepoRoot
  if (-not (Test-Path 'Module_2_Public_Website/src/components/SiteHeader.tsx')) { throw "Not in PCI_Clean repository: $RepoRoot" }
  $current = (& git rev-parse --show-toplevel)
  if ($LASTEXITCODE -ne 0 -or ([IO.Path]::GetFullPath($current).TrimEnd('\') -ine [IO.Path]::GetFullPath($RepoRoot).TrimEnd('\'))) { throw 'Run from the root of PCI_Clean, not a subdirectory.' }
  $branch = (& git branch --show-current).Trim()
  if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') { throw "Expected branch main; got '$branch'. No files changed." }
  $remote = (& git remote get-url origin).Trim()
  if ($LASTEXITCODE -ne 0 -or $remote -notmatch 'sasphand1/pci(\.git)?$') { throw "Unexpected origin remote '$remote'. No files changed." }
  $staged = @(& git diff --cached --name-only)
  if ($LASTEXITCODE -ne 0) { throw 'Could not inspect staged changes.' }
  if ($staged.Count -gt 0) { throw "There are already staged files ($($staged -join ', ')). Unstage/review them first; nothing was changed." }

  $files = @(
    'Module_2_Public_Website/src/components/SiteHeader.tsx',
    'Module_2_Public_Website/tests/public-header-template.test.mjs',
    'Module_2_Public_Website/tests/sleek-navigation.test.mjs'
  )
  foreach ($p in $files) {
    & git ls-files --error-unmatch -- $p 1>$null 2>$null
    if ($LASTEXITCODE -ne 0) { throw "Required tracked file is missing: $p" }
  }

  # Make sure previous local edits are either unchanged or the exact intended patch.
  # The patch script validates final navigation and tests before writing.
  $patch = Join-Path $PSScriptRoot 'APPLY_PCI_FIVE_TABS.mjs'
  Run-Checked 'node' @($patch,$RepoRoot,'--dry-run')
  Run-Checked 'node' @($patch,$RepoRoot)

  Write-Host "`nRunning full PCI public website check..." -ForegroundColor Cyan
  Run-Checked 'npm.cmd' @('--prefix','Module_2_Public_Website','run','check')

  Run-Checked 'git' (@('add','--') + $files)
  $names = @(& git diff --cached --name-only)
  if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect staged commit files.' }
  $unapproved = @($names | Where-Object { $files -notcontains $_ })
  if ($unapproved.Count -gt 0) { throw "Unexpected staged files: $($unapproved -join ', '). No commit was made." }
  if ($names.Count -eq 0) {
    Write-Host "`nNO NEW CHANGES: the 5-tab patch is already in the local commit history." -ForegroundColor Yellow
    Run-Checked 'git' @('push','origin','main')
  } else {
    Write-Host "`nStaged exactly $($names.Count) navigation-related files:" -ForegroundColor Green
    $names | ForEach-Object { Write-Host "  $_" }
    Run-Checked 'git' @('commit','-m','Simplify PCI header to five navigation tabs')
    Run-Checked 'git' @('push','origin','main')
  }
  $sha = (& git rev-parse --short HEAD).Trim()
  if ($LASTEXITCODE -ne 0) { throw 'Failed to read commit SHA.' }
  Write-Host "`nSUCCESS: pushed commit $sha to origin/main." -ForegroundColor Green
  Write-Host 'Navigation: Home | Events | Satellite | Insights | About'
  Write-Host 'Hostinger will update only if its GitHub deployment is configured to deploy this branch.'
} catch {
  Write-Host "`nSTOPPED: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'No unrelated files were staged by this script. If checks failed, the three navigation files may contain uncommitted edits.' -ForegroundColor Yellow
  exit 1
}
