param(
    [string]$ProjectRoot = (Join-Path $env:USERPROFILE 'Documents\PCI_Clean'),
    [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'
$moduleRoot = Join-Path $ProjectRoot 'Module_2_Public_Website'
$payloadRoot = Join-Path $PSScriptRoot 'payload'

$files = @(
    'src\components\RankingWheel.tsx',
    'src\components\SiteHeader.tsx',
    'src\components\CategoryRails.tsx',
    'src\components\HomeLeaderboard.tsx',
    'src\app\page.tsx',
    'packages\ui\src\styles\ranking-wheel.css',
    'packages\ui\src\styles\premium-home.css',
    'packages\ui\src\styles\sleek-rails.css',
    'packages\ui\src\styles\tokens.css',
    'packages\ui\src\styles.css'
)

if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot '.git') -PathType Container)) {
    throw "Git repository missing at: $ProjectRoot. Supply -ProjectRoot with your actual PCI_Clean path."
}
if (-not (Test-Path -LiteralPath (Join-Path $moduleRoot 'package.json') -PathType Leaf)) {
    throw "Module 2 not found at: $moduleRoot"
}
if (-not (Test-Path -LiteralPath (Join-Path $moduleRoot 'public\images\islamabad-dusk.webp') -PathType Leaf)) {
    throw 'Missing existing Islamabad hero image. Install the previous Premium UI V2 asset first; no files have been replaced.'
}

# Preflight ALL destinations before changing anything. This protects against a partial install.
foreach ($relative in $files) {
    if (-not (Test-Path -LiteralPath (Join-Path $payloadRoot $relative) -PathType Leaf)) {
        throw "Package is incomplete: $relative"
    }
    if (-not (Test-Path -LiteralPath (Join-Path $moduleRoot $relative) -PathType Leaf)) {
        throw "Existing project file not found: $relative. No changes made."
    }
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot = Join-Path $ProjectRoot "PCI_UI_Backups\before-claude-ui-$stamp"
$installed = New-Object System.Collections.Generic.List[string]

# Preserve originals with their original folder structure for easy restoration.
foreach ($relative in $files) {
    $backupFile = Join-Path $backupRoot $relative
    New-Item -Path (Split-Path -Parent $backupFile) -ItemType Directory -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $moduleRoot $relative) -Destination $backupFile -Force
}
Write-Host "Backed up 10 original files to $backupRoot" -ForegroundColor Cyan

try {
    foreach ($relative in $files) {
        $target = Join-Path $moduleRoot $relative
        Copy-Item -LiteralPath (Join-Path $payloadRoot $relative) -Destination $target -Force
        $installed.Add($relative)
    }

    if (-not $SkipTests) {
        Push-Location $moduleRoot
        try {
            & node --test 'tests/*.test.mjs'
            if ($LASTEXITCODE -ne 0) { throw "Module 2 tests failed with exit code $LASTEXITCODE" }
        } finally { Pop-Location }
    }
    Write-Host 'Installed the 10 reviewed UI files successfully.' -ForegroundColor Green
    Write-Host "Backup: $backupRoot" -ForegroundColor Green
    Write-Host 'Next: Review changes, commit, and push to main for Hostinger deployment.' -ForegroundColor Cyan
} catch {
    foreach ($relative in $installed) {
        Copy-Item -LiteralPath (Join-Path $backupRoot $relative) -Destination (Join-Path $moduleRoot $relative) -Force
    }
    Write-Host 'Installation failed; replaced files were restored from backup.' -ForegroundColor Red
    throw
}
