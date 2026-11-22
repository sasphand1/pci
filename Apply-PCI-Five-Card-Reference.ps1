$ErrorActionPreference = 'Stop'
$root = 'C:\Users\sasph\Documents\PCI_Clean'
Set-Location $root
$tsxFile = 'Module_2_Public_Website/src/components/PublishedWheel.tsx'
$cssFile = 'Module_2_Public_Website/src/app/public-stage.css'
$testFile = 'Module_2_Public_Website/tests/glass-public.test.mjs'
$utf8 = New-Object System.Text.UTF8Encoding($false)
foreach ($file in @($tsxFile, $cssFile, $testFile)) {
  if (!(Test-Path $file)) { throw "Missing: $file" }
}
$tsx = [System.IO.File]::ReadAllText((Resolve-Path $tsxFile).Path)
$css = [System.IO.File]::ReadAllText((Resolve-Path $cssFile).Path)
$test = [System.IO.File]::ReadAllText((Resolve-Path $testFile).Path)

# Five slots only, centered on the selected entry, with wraparound at either end.
$slotPattern = '(?s)const SLOTS:\{slot:number;step:number\}\[\] = \[.*?\];'
if ($tsx -match $slotPattern) {
  $tsx = [regex]::Replace($tsx, $slotPattern, 'const SLOTS = [-2,-1,0,1,2] as const;')
} elseif ($tsx -notmatch 'const SLOTS = \[-2,-1,0,1,2\] as const;') {
  throw 'Unexpected SLOTS format: no changes saved.'
}
$shownPattern = '(?s)const shown = SLOTS\s*\.map\(\(\{slot,step\}\)=>\(\{slot,entry:.*?\}\)\)\s*\.filter\(\(x\):x is \{slot:number;entry:PubEntry\}=>Boolean\(x.entry\)\);'
$shownReplacement = @'
const shown = SLOTS
    .map(slot=>({
      slot,
      entry: cards.length > Math.abs(slot)
        ? cards[((index + slot) % cards.length + cards.length) % cards.length]
        : undefined
    }))
    .filter((x):x is {slot:number;entry:PubEntry}=>Boolean(x.entry));
'@
if ($tsx -match $shownPattern) {
  $tsx = [regex]::Replace($tsx, $shownPattern, $shownReplacement)
} elseif ($tsx -notmatch 'cards\.length > Math\.abs\(slot\)') {
  throw 'Unexpected shown map format: no changes saved.'
}
# Remove encoding-damaged arrow labels if they exist; navigation still works by drag, scroll and keyboard.
# CSS hides arrow buttons, retaining accessible handlers in current source.

# Update the source-pattern test so it checks five slots rather than the obsolete eight.
$testPattern = 'for\(const \[slot,step\] of \[\[-4,6\],\[-3,4\],\[-2,3\],\[-1,1\],\[0,0\],\[1,2\],\[2,5\],\[3,7\]\]\)assert\.ok\(w\.includes\(`\{slot:\$\{slot\},step:\$\{step\}\}`\),`slot \$\{slot\}`\);'
if ($test -match $testPattern) {
  $test = [regex]::Replace($test, $testPattern, "assert.match(w,/const SLOTS = \[\-2,\-1,0,1,2\] as const/);")
} elseif ($test -notmatch 'const SLOTS =') {
  throw 'Unexpected legacy wheel test: no changes saved.'
}
$test = $test.Replace('stage follows the mockup: 8 slots (4 left, 3 right), crown only on #1, honest stats', 'stage uses five centered slots, crown only on #1, honest stats')

# Replace only our own previous style block; leave all other site styles intact.
$css = [regex]::Replace($css, '(?s)/\* PCI FIVE CARD REFERENCE START \*/.*?/\* PCI FIVE CARD REFERENCE END \*/\s*', '')
$cardCSS = @'

/* PCI FIVE CARD REFERENCE START */
/* The podium and rings are already baked into hero-stage.png. */
@media (min-width: 901px) {
  .pci-stage .stage-wheel {
    --cw: 10cqw;
    --ch: 16.3cqw;
    --cc: 13.5cqw;
    --cch: 20.8cqw;
    --gap: 1.15cqw;
    --shift: 0px;
    margin-top: clamp(104px, 8vw, 148px);
    height: calc(var(--cch) + 6.6cqw);
  }
  .pci-stage .stage-card { bottom: 4cqw; }
  .pci-stage .stage-card[data-center="true"] { bottom: 4.7cqw; }
}
/* A small raised winner over the IMAGE's own gold platform. */
.pci-stage .stage-card {
  overflow: visible;
  border-radius: 1.15cqw;
  border: 1px solid rgba(17,223,189,.62);
  background: #061b1d;
  box-shadow: 0 12px 30px rgba(0,0,0,.34), 0 0 13px rgba(12,199,171,.19);
}
.pci-stage .stage-card[data-center="true"] {
  border: 1.5px solid #f1c66f;
  box-shadow: 0 0 0 1px rgba(255,226,144,.32), 0 0 24px rgba(239,193,89,.42), 0 16px 38px rgba(0,0,0,.38);
  z-index: 5;
}
.pci-stage .stage-photo {
  border-radius: 1.08cqw 1.08cqw 0 0;
  overflow: hidden;
  inset: 0 0 33% 0;
}
.pci-stage .stage-card[data-center="true"] .stage-photo { inset: 0 0 34% 0; }
.pci-stage .stage-body {
  height: 35%;
  padding: .7cqw .55cqw .66cqw;
  gap: .55cqw;
  border-radius: 0 0 1.06cqw 1.06cqw;
  overflow: hidden;
  justify-content: center;
  background: linear-gradient(180deg,rgba(3,22,23,.85),#041b1c 34%,#031719);
}
.pci-stage .stage-card[data-center="true"] .stage-body {height:36%;gap:.65cqw;}
.pci-stage .stage-body strong {font-size:clamp(12px,1.12cqw,16px);line-height:1.14;}
.pci-stage .stage-card[data-center="true"] .stage-body strong {font-size:clamp(17px,1.6cqw,24px);}
.pci-stage .stage-rank {
  min-width: 2.5cqw;
  height: 2.55cqw;
  padding: .43cqw .66cqw .25cqw .55cqw;
  font-size: clamp(13px,1.28cqw,19px);
  border-radius: 1.03cqw 0 0 0;
  background: linear-gradient(135deg,#031519 0 72%,transparent 72.5%);
}
.pci-stage .stage-card[data-center="true"] .stage-rank {
  min-width: 3.15cqw;
  height: 3.2cqw;
  padding: .55cqw .8cqw .3cqw .62cqw;
  font-size: clamp(19px,1.9cqw,27px);
}
.pci-stage .stage-crown {
  top: -3.3cqw;
  width: 4.7cqw;
  z-index: 12;
  filter: drop-shadow(0 0 8px rgba(255,199,71,.8));
}
.pci-stage .stage-crown svg {fill:#f1c158}
.pci-stage .stage-count b {font-size:clamp(13px,1.28cqw,19px)}
.pci-stage .stage-card[data-center="true"] .stage-count b {font-size:clamp(22px,2.15cqw,32px)}
/* Never render a second CSS platform or pagination dots over the image. */
.pci-stage .stage-floor-rings,.pci-stage .stage-podium,.pci-stage .stage-dots {display:none!important}
/* On smaller screens, retain at most three centered cards. */
@media (max-width: 900px) {
  .pci-stage .stage-card[data-slot="-2"],
  .pci-stage .stage-card[data-slot="2"] {display:none}
  .pci-stage .stage-card[data-center="true"] {overflow:visible}
  .pci-stage .stage-crown {top:-8.8cqw;width:12cqw}
  .pci-stage .stage-photo {border-radius:2.1cqw 2.1cqw 0 0}
}
/* PCI FIVE CARD REFERENCE END */
'@
$css = $css.TrimEnd() + "`r`n" + $cardCSS + "`r`n"

# Backup BEFORE writing. Restore local files if any subsequent npm check fails.
$tag = Get-Date -Format 'yyyyMMdd_HHmmss'
foreach ($file in @($tsxFile,$cssFile,$testFile)) { Copy-Item $file "$file.before-five-card-$tag.bak" -Force }
[System.IO.File]::WriteAllText((Resolve-Path $tsxFile).Path, $tsx, $utf8)
[System.IO.File]::WriteAllText((Resolve-Path $cssFile).Path, $css, $utf8)
[System.IO.File]::WriteAllText((Resolve-Path $testFile).Path, $test, $utf8)
Write-Host 'Five-card reference styling applied locally. No commit or push performed.' -ForegroundColor Cyan
Write-Host 'Run npm run check, review the result, then commit and push when ready.' -ForegroundColor Cyan
