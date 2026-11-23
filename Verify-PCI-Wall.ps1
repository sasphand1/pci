param([string]$Site='https://darkcyan-wasp-393761.hostingersite.com', [string]$Api='https://traveled-blanchedalmond-woodpecker-58.hostingersite.com')
$ErrorActionPreference='Stop'
function Check($url){
  $h= & curl.exe -sS -L -D - -o NUL --max-time 25 -A 'Googlebot' $url
  if($LASTEXITCODE -ne 0){ throw "Request failed: $url" }
  $headers=@($h | Where-Object {$_ -match '^HTTP/' -or $_ -match '(?i)^x-robots-tag:'})
  $statuses=@($h | Where-Object {$_ -match '^HTTP/\S+\s+[0-9]{3}'})
  if (-not $statuses -or $statuses[-1] -notmatch '^HTTP/\S+\s+200(?:\s|$)') { throw "FAIL: Googlebot-style request did not return final HTTP 200: $url; $($statuses -join ', ')" }
  Write-Host "`n$url" -ForegroundColor Cyan
  $headers | ForEach-Object {Write-Host $_}
  return $headers
}
$robots=Check "$Site/robots.txt"
$wall=Check "$Site/wall"
$apiHeaders=Check "$Api/api/v1/wall/messages?limit=1"
if(($wall -join ' ') -notmatch '(?i)noindex'){throw 'FAIL: Wall is missing X-Robots-Tag noindex.'}
if(($apiHeaders -join ' ') -notmatch '(?i)noindex'){throw 'FAIL: Public API is missing X-Robots-Tag noindex.'}
$r=(Invoke-WebRequest -Uri "$Site/robots.txt" -UseBasicParsing).Content
if($r -match '(?im)^Disallow:\s*/wall(?:\s|$)'){throw 'FAIL: robots.txt blocks wall, so Google cannot read noindex.'}
Write-Host 'PASS: Wall and API send noindex, and robots.txt permits Google to see Wall noindex.' -ForegroundColor Green
Write-Host 'NOTE: Spoofed Googlebot is not Google Search Console URL Inspection and does not clear a security warning.'
