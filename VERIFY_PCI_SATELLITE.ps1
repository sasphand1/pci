# Run from the existing PCI repository ROOT in Windows PowerShell 5.1 or newer.
$ErrorActionPreference = 'Stop'
foreach ($module in @('Module_1_Adapter','Module_2_Public_Website','Module_3_Admin_Panel')) {
  if (!(Test-Path (Join-Path $module 'package.json'))) { throw "Not in PCI root: $module missing" }
  Write-Host "Testing $module" -ForegroundColor Cyan
  & npm --prefix $module test
  if ($LASTEXITCODE -ne 0) { throw "$module tests failed" }
  Write-Host "Building $module" -ForegroundColor Cyan
  & npm --prefix $module run build
  if ($LASTEXITCODE -ne 0) { throw "$module build failed" }
}
Write-Host 'ALL PCI TEST AND BUILD COMMANDS PASSED LOCALLY' -ForegroundColor Green
Write-Host 'Review git status and GitHub Actions before pushing or deploying.' -ForegroundColor Yellow
