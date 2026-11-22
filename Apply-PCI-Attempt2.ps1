# Run from the PCI_Clean repository root in PowerShell 7 or Windows PowerShell 5.1.
$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
if (-not (Test-Path (Join-Path $root 'Module_2_Public_Website/package.json'))) {
  throw 'Run this script from the PCI_Clean repository root.'
}
if ((git branch --show-current) -ne 'main') { throw 'Expected main branch.' }
$image = Join-Path $root 'Module_2_Public_Website/public/images/hero-stage.png'
if (-not (Test-Path $image)) { throw "Required image missing: $image" }
$target = Join-Path $root 'Module_2_Public_Website/src/app/public-stage.css'
$source = Join-Path $PSScriptRoot 'public-stage.css'
if (-not (Test-Path $source)) { throw 'Keep public-stage.css next to this script.' }
$backupDir = Join-Path $root '.pci-attempt2-local-backup'
New-Item -Path $backupDir -ItemType Directory -Force | Out-Null
Copy-Item $target (Join-Path $backupDir 'public-stage.css.before-attempt2') -Force
Copy-Item $source $target -Force
Write-Host 'Attempt 2 stage stylesheet installed. Backup saved to .pci-attempt2-local-backup.' -ForegroundColor Cyan
Push-Location (Join-Path $root 'Module_2_Public_Website')
try {
  npm run typecheck
  if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed. Nothing was committed.' }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Build failed. Nothing was committed.' }
} finally { Pop-Location }
Write-Host 'Typecheck and build passed.' -ForegroundColor Green
Write-Host 'Review locally first with: cd Module_2_Public_Website; npm run dev' -ForegroundColor Yellow
Write-Host 'To push after visual review:' -ForegroundColor Yellow
Write-Host 'git add -- Module_2_Public_Website/src/app/public-stage.css'
Write-Host 'git commit -m "Align PCI landing screen with reference (attempt 2)"'
Write-Host 'git push origin main'
