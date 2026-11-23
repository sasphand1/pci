# Applies ONLY the reviewed /events-radar.html change from a clean temporary worktree.
# Never stages unrelated or other-team changes. Stops on version drift or test failures.
param(
  [string]$Repo = 'C:\Users\sasph\Documents\PCI_Clean'
)
$ErrorActionPreference='Stop'
$patch=Join-Path $PSScriptRoot 'PCI_Events_Redirect_Fix.patch'
$exact='Module_2_Public_Website/public/events-radar.html'
$expectedBlob='4383c6a09943d3a2a640dfdc650fb26db6f3ad86'
if(!(Test-Path -LiteralPath $patch -PathType Leaf)){throw 'Patch missing'}
if(!(Test-Path -LiteralPath (Join-Path $Repo '.git'))){
  # Git worktree .git may be a file; still require a repository.
  & git -C $Repo rev-parse --show-toplevel *> $null
  if($LASTEXITCODE -ne 0){throw 'Not a Git repository'}
}
& git -C $Repo fetch origin main
if($LASTEXITCODE -ne 0){throw 'git fetch failed'}
$currentBlob=(& git -C $Repo rev-parse "origin/main:$exact").Trim()
if($LASTEXITCODE -ne 0){throw 'Cannot find Events source in origin/main'}
if($currentBlob -ne $expectedBlob){throw "Events source changed since patch review ($currentBlob). Refusing to overwrite other team's work."}
$worktree=Join-Path $env:TEMP ('pci-events-fix-'+[guid]::NewGuid().ToString('N'))
& git -c core.autocrlf=false -C $Repo worktree add --detach $worktree origin/main
if($LASTEXITCODE -ne 0){throw 'Temporary worktree failed'}
Write-Host "Temporary isolated worktree: $worktree"
$checkedOutBlob=(& git -C $worktree hash-object --no-filters -- $exact).Trim()
if($LASTEXITCODE -ne 0 -or $checkedOutBlob -ne $expectedBlob){throw "Unexpected working tree line endings/source ($checkedOutBlob); nothing pushed"}
& git -C $worktree apply --check $patch
if($LASTEXITCODE -ne 0){throw "Patch check failed; nothing pushed. Inspect $worktree"}
& git -C $worktree apply $patch
if($LASTEXITCODE -ne 0){throw "Patch apply failed; nothing pushed. Inspect $worktree"}
$changed=@(& git -C $worktree diff --name-only)
if($changed.Count -ne 1 -or $changed[0].Trim() -ne $exact){throw "Unexpected modified files; nothing pushed. Inspect $worktree"}
& git -C $worktree diff --check
if($LASTEXITCODE -ne 0){throw 'Whitespace validation failed; nothing pushed'}
Push-Location (Join-Path $worktree 'Module_2_Public_Website')
try {
  & npm ci
  if($LASTEXITCODE -ne 0){throw "npm ci failed; nothing pushed. Worktree: $worktree"}
  & npm run check
  if($LASTEXITCODE -ne 0){throw "Module 2 build/tests failed; nothing pushed. Worktree: $worktree"}
} finally { Pop-Location }
& git -C $worktree add -- $exact
if($LASTEXITCODE -ne 0){throw 'Staging failed'}
& git -C $worktree commit -m 'Remove unnecessary top-level Events JavaScript redirect'
if($LASTEXITCODE -ne 0){throw 'Commit failed; nothing pushed'}
& git -C $worktree push origin HEAD:main
if($LASTEXITCODE -ne 0){throw "Push failed (possibly concurrent update); no force-push attempted. Worktree: $worktree"}
$commit=(& git -C $worktree rev-parse --short HEAD).Trim()
& git -C $Repo worktree remove $worktree
if($LASTEXITCODE -ne 0){Write-Warning "Push worked, but remove temporary worktree manually: $worktree"}
Write-Host "SUCCESS: Events-only fix pushed ($commit). NEXT: redeploy Hostinger Module 2 and run Test-Googlebot.ps1." -ForegroundColor Green
