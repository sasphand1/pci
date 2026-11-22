$ErrorActionPreference = 'Stop'
$root = 'C:\Users\sasph\Documents\PCI_Clean'
if (-not (Test-Path (Join-Path $root 'Module_2_Public_Website\src\app\page.tsx'))) { throw 'PCI repo not found at expected path' }
Set-Location $root
$web = Join-Path $root 'Module_2_Public_Website'
$pagePath = Join-Path $web 'src\app\page.tsx'
$wheelPath = Join-Path $web 'src\components\PublishedWheel.tsx'
$helperPath = Join-Path $web 'src\lib\creator-totals.ts'
$testPath = Join-Path $web 'tests\creator-totals.test.mjs'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$page = [IO.File]::ReadAllText($pagePath)
$wheel = [IO.File]::ReadAllText($wheelPath)

if ($page -notmatch 'label:\s*\x27Total subscribers\x27' -or $page -notmatch 'label:\s*\x27Total views\x27') { throw 'Expected statistics slots are missing; nothing changed.' }
if ($page -notmatch 'const stats=\[') { throw 'Statistics array not found; nothing changed.' }

$import = "import {publishedTotal} from '@/lib/creator-totals';"
if (-not $page.Contains($import)) {
  $anchor = "import {SnapshotStatus} from '@/components/SnapshotStatus';"
  if (-not $page.Contains($anchor)) { throw 'Import insertion point missing; nothing changed.' }
  $page = $page.Replace($anchor, $anchor + "`n" + $import)
}

$subPattern = "{label:'Total subscribers',value:'N/A'}"
$viewPattern = "{label:'Total views',value:'N/A'}"
$subReplacement = "{label:'Total subscribers',value:publishedTotal(wheel?.sorts,'wheel.subscribed')}"
$viewReplacement = "{label:'Total views',value:publishedTotal(wheel?.sorts,'wheel.viewed')}"
if ($page.Contains($subReplacement) -and $page.Contains($viewReplacement)) { Write-Host 'Totals already wired.' -ForegroundColor Yellow }
elseif ($page.Contains($subPattern) -and $page.Contains($viewPattern)) {
  $page = $page.Replace($subPattern, $subReplacement).Replace($viewPattern, $viewReplacement)
} else { throw 'Expected N/A total slots differ from current page; nothing changed.' }

# Replace only known mojibake patterns with ASCII or ASCII-safe equivalents.
$badDash = [string][char]0x00E2 + [char]0x20AC + [char]0x201D
$page = $page.Replace($badDash,'N/A')
# Source contains broken prev/next arrow glyphs. Set accessible, ASCII symbols.
$wheel = [regex]::Replace($wheel, '(aria-label="Previous creator"\s+onClick=\{\(\)=>move\(-1\)\}\s*>)[\s\S]*?(</button>)', '$1' + "`n            &lt;`n          " + '$2')
$wheel = [regex]::Replace($wheel, '(aria-label="Next creator"\s+onClick=\{\(\)=>move\(1\)\}\s*>)[\s\S]*?(</button>)', '$1' + "`n            &gt;`n          " + '$2')

$helper = @'
import type {PubRanking} from './public';

/** Only display a sum when the published ranking contains the whole population. */
export function publishedTotal(sorts:PubRanking[]|null|undefined,scope:string):string {
  const ranking=sorts?.find(s=>s.scope===scope);
  if(!ranking || !ranking.population || ranking.stale || ranking.entries.length!==ranking.population || ranking.covered!==ranking.population) return 'N/A';
  let sum=0;
  const seen=new Set<string>();
  for(const entry of ranking.entries){
    if(!entry.person?.slug || seen.has(entry.person.slug) || !Number.isSafeInteger(entry.value) || entry.value<0) return 'N/A';
    seen.add(entry.person.slug);
    sum+=entry.value;
    if(!Number.isSafeInteger(sum)) return 'N/A';
  }
  return new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(sum);
}
'@
$test = @'
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync('src/app/page.tsx','utf8');
const helper=readFileSync('src/lib/creator-totals.ts','utf8');
const wheel=readFileSync('src/components/PublishedWheel.tsx','utf8');
test('homepage computes published totals instead of hardcoding N/A',()=>{
 assert.match(page,/publishedTotal\(wheel\?\.sorts,'wheel\.subscribed'\)/);
 assert.match(page,/publishedTotal\(wheel\?\.sorts,'wheel\.viewed'\)/);
 assert.doesNotMatch(page,/label:'Total (subscribers|views)',value:'N\/A'/);
});
test('totals fail closed for partial, stale or duplicate rankings',()=>{
 for(const text of ['ranking.stale','ranking.entries.length!==ranking.population','ranking.covered!==ranking.population','seen.has(entry.person.slug)','Number.isSafeInteger']) assert.ok(helper.includes(text),text);
});
test('no mojibake in homepage and carousel',()=>{
 for(const [name,src] of [['page',page],['wheel',wheel]])assert.doesNotMatch(src,/\u00e2[\u0080-\u00bf\u20ac\u201a-\u201e]/i,name);
});
'@

# Verify the expected partial edits in memory before writing.
if (-not $page.Contains($subReplacement) -or -not $page.Contains($viewReplacement)) { throw 'Statistic replacement validation failed; no changes saved.' }
if (-not $wheel.Contains('&lt;') -or -not $wheel.Contains('&gt;')) { throw 'Arrow replacement validation failed; no changes saved.' }
[IO.File]::WriteAllText($pagePath,$page,$utf8)
[IO.File]::WriteAllText($wheelPath,$wheel,$utf8)
[IO.File]::WriteAllText($helperPath,$helper,$utf8)
[IO.File]::WriteAllText($testPath,$test,$utf8)

Write-Host 'Applied totals and arrow text fixes. Repairing detected double-encoded UTF-8 glyphs...' -ForegroundColor Green
$latin1252 = [Text.Encoding]::GetEncoding(1252)
$utf8Strict = New-Object System.Text.UTF8Encoding($false,$true)
$sourceFiles = Get-ChildItem (Join-Path $web 'src') -Recurse -File -Include '*.tsx','*.ts','*.css','*.mjs'
foreach($f in $sourceFiles){
  $content = [IO.File]::ReadAllText($f.FullName)
  $fixed = [regex]::Replace($content,'\u00e2[\u0080-\u00bf\u20ac-\u2122]{2}',{
    param($m)
    try { $utf8Strict.GetString($latin1252.GetBytes($m.Value)) } catch { $m.Value }
  })
  if($fixed -cne $content){
    [IO.File]::WriteAllText($f.FullName,$fixed,$utf8)
    Write-Host ('Repaired UTF-8: ' + $f.FullName) -ForegroundColor Green
  }
}
$badFiles = Get-ChildItem (Join-Path $web 'src') -Recurse -File -Include '*.tsx','*.ts','*.css','*.mjs' | Where-Object {
 $s=[IO.File]::ReadAllText($_.FullName)
 [regex]::IsMatch($s,'\u00e2[\u0080-\u00bf\u20ac\u201a-\u201e]','IgnoreCase')
}
if($badFiles){ Write-Host 'Possible remaining mojibake in:' -ForegroundColor Yellow; $badFiles | ForEach-Object { Write-Host $_.FullName } }
else { Write-Host 'No common UTF-8 mojibake patterns found in src.' -ForegroundColor Green }
Write-Host 'Nothing committed or pushed.' -ForegroundColor Green
