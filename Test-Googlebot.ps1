# Read-only GET-based probe. Does not pretend to be verified Googlebot.
param([string]$Site = 'https://darkcyan-wasp-393761.hostingersite.com')
$ErrorActionPreference='Stop'
$Site=$Site.TrimEnd('/')
$agents=@(
  @{name='Browser';userAgent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'},
  @{name='Googlebot-UA';userAgent='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'}
)
$paths=@('/','/events','/events.html','/events-radar.html','/robots.txt','/sitemap.xml')
$results=@()
$failed=$false
foreach($path in $paths){
  foreach($agent in $agents){
    $body=[System.IO.Path]::GetTempFileName()
    $headers=[System.IO.Path]::GetTempFileName()
    try {
      $url=$Site+$path+'?pci_crawl_check='+[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
      $result=(& curl.exe --silent --show-error --location --max-redirs 5 --connect-timeout 10 --max-time 35 --user-agent $agent.userAgent --header 'Cache-Control: no-cache' --dump-header $headers --output $body --write-out 'STATUS:%{http_code}|REDIRECTS:%{num_redirects}|FINAL:%{url_effective}' $url)
      if($LASTEXITCODE -ne 0){throw "curl error $LASTEXITCODE ($result)"}
      if($result -notmatch '^STATUS:(\d{3})\|REDIRECTS:(\d+)\|FINAL:(.+)$'){throw "Unexpected curl output: $result"}
      $status=[int]$Matches[1];$redirects=[int]$Matches[2];$finalUrl=$Matches[3]
      $html=[System.IO.File]::ReadAllText($body)
      $headerText=[System.IO.File]::ReadAllText($headers)
      $challenge=[regex]::IsMatch($html,'(?i)(access denied|verify you are human|checking your browser|attention required!|automated requests are blocked)')
      $oldScript=($path -eq '/events-radar.html' -and $html.Contains("location.replace('/events'"))
      $ok=($status -eq 200 -and !$challenge -and !$oldScript)
      if(!$ok){$failed=$true}
      $robotsTags=[regex]::Matches($headerText,'(?im)^x-robots-tag:\s*(.+)$') | ForEach-Object {$_.Groups[1].Value.Trim()}
      $results += [PSCustomObject]@{Path=$path;Agent=$agent.name;Status=$status;Redirects=$redirects;OK=$ok;Challenge=$challenge;OldScript=$oldScript;Final=$finalUrl;XRobots=($robotsTags -join ';')}
    } catch {
      $failed=$true
      $results += [PSCustomObject]@{Path=$path;Agent=$agent.name;Status='ERROR';Redirects='';OK=$false;Challenge='';OldScript='';Final=$_.Exception.Message;XRobots=''}
    } finally {
      Remove-Item -LiteralPath $body,$headers -Force -ErrorAction SilentlyContinue
    }
  }
}
$results | Format-Table Path,Agent,Status,Redirects,OK,Challenge,OldScript -AutoSize
foreach($path in $paths){
  $b=$results | Where-Object {$_.Path -eq $path -and $_.Agent -eq 'Browser'} | Select-Object -First 1
  $g=$results | Where-Object {$_.Path -eq $path -and $_.Agent -eq 'Googlebot-UA'} | Select-Object -First 1
  try { $browserFinal=([uri]$b.Final).GetLeftPart([System.UriPartial]::Path) } catch { $browserFinal=$b.Final }
  try { $botFinal=([uri]$g.Final).GetLeftPart([System.UriPartial]::Path) } catch { $botFinal=$g.Final }
  if($b.Status -ne $g.Status -or $browserFinal -ne $botFinal){
    Write-Warning "Agent response differs at $path; review WAF/CDN and Search Console URL Inspection."
    $failed=$true
  }
}
if($failed){
  Write-Host 'FAIL: At least one response failed, redirected unexpectedly, or served old Events redirect. Review details above.' -ForegroundColor Red
  exit 1
}
Write-Host 'PASS: Browser and Googlebot-like User-Agent both receive HTTP 200; no detected challenge or old JS redirect.' -ForegroundColor Green
Write-Host 'This does NOT authenticate as real Googlebot. Confirm using Google Search Console URL Inspection > Test Live URL.'
