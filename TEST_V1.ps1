# Run from PCI_Clean parent folder, after all three modules are running.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
Write-Host 'V1.0 live smoke checks' -ForegroundColor Cyan
$urls = @{
  'Backend ready' = 'http://localhost:8081/health/ready'
  'Public site'   = 'http://localhost:3000'
  'Admin panel'   = 'http://localhost:3001'
}
foreach ($name in $urls.Keys) {
  try {
    $r = Invoke-WebRequest -Uri $urls[$name] -UseBasicParsing -TimeoutSec 10
    Write-Host "PASS $name : HTTP $($r.StatusCode)" -ForegroundColor Green
  } catch {
    Write-Host "FAIL $name : $($_.Exception.Message)" -ForegroundColor Red
  }
}
try {
  $data=Invoke-RestMethod 'http://localhost:8081/api/v1/rankings?sort=subscribers&limit=100' -TimeoutSec 10
  if ($null -eq $data.meta.coverage) {throw 'Missing V1.0 coverage metadata. Rebuild Module 1.'}
  Write-Host "Metric: $($data.meta.sort); tracked: $($data.meta.total); known: $($data.meta.coverage.known); unavailable: $($data.meta.coverage.unavailable)"
  Write-Host "Published at: $($data.meta.asOf)"
  $data.data | Select-Object -First 5 rank,displayName,subscriberCount,viewCount,videoCount | Format-Table -AutoSize
  foreach ($metric in 'views','videos') {
    $r=Invoke-RestMethod "http://localhost:8081/api/v1/rankings?sort=$metric&limit=100" -TimeoutSec 10
    Write-Host "$metric : $($r.meta.coverage.known)/$($r.meta.coverage.total) values available"
  }
} catch {Write-Host "FAIL Rankings: $($_.Exception.Message)" -ForegroundColor Red}
Write-Host 'A passing health request does NOT prove that YouTube data is present or verified.' -ForegroundColor Yellow
