$ErrorActionPreference = 'Stop'

$root = 'C:\Users\sasph\Documents\PCI_Clean'
$relative = 'Module_2_Public_Website\src\app\public-stage.css'
$path = Join-Path $root $relative
if (!(Test-Path -LiteralPath $path)) { throw "Missing CSS file: $path" }
if ((git -C $root branch --show-current) -ne 'main') { throw 'Not on main branch' }

$original = [System.IO.File]::ReadAllText($path)
$content = $original
$changes = 0
function Replace-Exact([string]$old, [string]$new, [string]$label) {
    $script:content = $script:content.Replace("`r`n", "`n")
    $old = $old.Replace("`r`n", "`n")
    $new = $new.Replace("`r`n", "`n")
    $hits = ([regex]::Matches($script:content, [regex]::Escape($old))).Count
    if ($hits -ne 1) { throw "[$label] Expected exactly one matching CSS section, found $hits. No file was written." }
    $script:content = $script:content.Replace($old, $new)
    $script:changes++
}

# 1. Remove inherited white pill styling from landing/header nav links.
Replace-Exact @'
.site-shell .pci-site-header .pci-primary-nav a{
  position:relative;
  padding:6px 0;
'@ @'
.site-shell .pci-site-header .pci-primary-nav a,
.site-shell .pci-site-header .pci-primary-nav a[aria-current=page]{
  background:transparent;
  border:0;
  border-radius:0;
  box-shadow:none;
  min-height:0;
}
.site-shell .pci-site-header .pci-primary-nav a{
  position:relative;
  padding:6px 0;
'@ '1: header pills'

# 2. Compact header and controls (anchored in exact rules).
Replace-Exact @'
  min-height:78px;
  margin:0 auto;
  display:flex;
  align-items:center;
  gap:24px;
'@ @'
  min-height:56px;
  margin:0 auto;
  padding:0 22px;
  display:flex;
  align-items:center;
  gap:20px;
'@ '2: header dimensions'
Replace-Exact @'
.site-shell .pci-header-search{
  min-width:380px;
  height:44px;
'@ @'
.site-shell .pci-header-search{
  min-width:300px;
  height:36px;
'@ '2: search dimensions'
Replace-Exact @'
.site-shell .pci-header-cta{
  height:42px;
  border-radius:999px;
'@ @'
.site-shell .pci-header-cta{
  height:36px;
  border-radius:999px;
'@ '2: header action height'
Replace-Exact @'
  width:42px;
  height:42px;
  border-radius:12px;
'@ @'
  width:34px;
  height:34px;
  border-radius:10px;
'@ '2: brand mark'
Replace-Exact @'
  font-size:1.64rem;
'@ @'
  font-size:1.3rem;
'@ '2: brand size'
Replace-Exact @'
  bottom:-13px;
'@ @'
  bottom:-10px;
'@ '2: active underline'

# 3. Shorter hero title/spacing/tabs/region labels.
Replace-Exact @'
  padding:12px 0 18px;
  min-height:690px;
'@ @'
  padding:10px 0 14px;
  min-height:calc(100svh - 56px);
  max-height:none;
'@ '3: hero height'
Replace-Exact @'
  font-size:clamp(2.35rem,4vw,4.2rem);
  line-height:1.04;
'@ @'
  font-size:clamp(2.1rem,3.55vw,3.4rem);
  line-height:1;
'@ '3: title scale'
Replace-Exact @'
  margin:12px 0 8px;
  color:#FFF8E9;
'@ @'
  margin:8px 0 6px;
  color:#FFF8E9;
'@ '3: title margin'
Replace-Exact @'
  margin:18px auto 0;
  padding:4px;
'@ @'
  margin:12px auto 0;
  padding:3px;
'@ '3: tab margin'
Replace-Exact @'
  min-height:48px;
  padding:0 28px;
'@ @'
  min-height:38px;
  padding:0 30px;
'@ '3: tab dimensions'
Replace-Exact @'
  margin:90px auto 0;
  height:40px;
'@ @'
  margin:72px auto 0;
  height:30px;
'@ '3: region spacing'

# 4. Card dimensions, crown visibility, photo corner clipping.
Replace-Exact @'
  --cw:10.1cqw;
  --ch:16.6cqw;
  --cc:15.1cqw;
  --cch:21.6cqw;
  --gap:.9cqw;
'@ @'
  --cw:8.9cqw;
  --ch:14.6cqw;
  --cc:13.6cqw;
  --cch:18.6cqw;
  --gap:.55cqw;
'@ '4: wheel scale'
Replace-Exact @'
  margin-top:14px;
  height:calc(var(--cch) + 7.5cqw);
'@ @'
  margin-top:0;
  height:calc(var(--cch) + 6.5cqw);
'@ '4: wheel position'
Replace-Exact @'
  bottom:5.55cqw;
  z-index:4;
'@ @'
  bottom:6.2cqw;
  z-index:4;
'@ '4: winner height'
Replace-Exact @'
  top:-4.4cqw;
  transform:translateX(-50%);
  width:5.3cqw;
'@ @'
  top:-3.6cqw;
  transform:translateX(-50%);
  width:4.6cqw;
'@ '4: crown'
Replace-Exact @'
  overflow:hidden;
  border-radius:1.15cqw;
'@ @'
  overflow:visible;
  border-radius:1.15cqw;
'@ '4: card overflow'
Replace-Exact @'
  inset:0 0 33% 0;
  overflow:hidden;
'@ @'
  inset:0 0 33% 0;
  overflow:hidden;
  border-radius:1.15cqw 1.15cqw 0 0;
'@ '4: photo corners'

# 5. Podium and stats strip.
Replace-Exact @'
  bottom:2.2cqw;
  width:17.8cqw;
  height:4.8cqw;
'@ @'
  bottom:2.4cqw;
  width:20cqw;
  height:4.2cqw;
'@ '5: podium'
Replace-Exact @'
  margin:0 0 20px;
'@ @'
  margin:0 0 12px;
'@ '5: dots'
Replace-Exact @'
  min-height:82px;
  padding:0 18px;
  border-radius:18px;
'@ @'
  min-height:62px;
  padding:0 18px;
  border-radius:16px;
  width:min(100%,1160px);
  margin:0 auto;
'@ '5: stats strip'
Replace-Exact @'
  font-size:1.45rem;
  line-height:1;
'@ @'
  font-size:1.15rem;
  line-height:1;
'@ '5: stats numbers'

$backup = "$path.lovable-before-attempt2.bak"
if (Test-Path -LiteralPath $backup) { throw "Backup already exists: $backup. Rename it before running again." }
[System.IO.File]::WriteAllText($backup, $original, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host "Applied $changes exact replacements (Lovable's five requested groups)." -ForegroundColor Green
Write-Host "Backup: $backup"
Write-Host 'Only public-stage.css was modified.'
