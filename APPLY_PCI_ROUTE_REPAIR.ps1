$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $root 'Module_1_Adapter\src\server.ts'
if (!(Test-Path -LiteralPath $target)) { throw "Run from PCI_Clean root: Module_1_Adapter/src/server.ts not found" }
$content = [System.IO.File]::ReadAllText($target)
$needs = @(
  @{ Marker = "import {crossPublicRoutes,crossAdminRoutes} from './modules/cross-platform/routes.js';"; Anchor = "import {instagramPublicRoutes,instagramAdminRoutes} from './modules/instagram/routes.js';" },
  @{ Marker = "import {unifiedPublicRoutes,unifiedAdminRoutes} from './modules/unified/routes.js';"; Anchor = "import {crossPublicRoutes,crossAdminRoutes} from './modules/cross-platform/routes.js';" },
  @{ Marker = "  app.use('/api/v1',unifiedPublicRoutes);"; Anchor = "  app.use('/api/v1',publicRoutes);" },
  @{ Marker = "  app.use('/api/v1',crossPublicRoutes);"; Anchor = "  app.use('/api/v1',instagramPublicRoutes);" },
  @{ Marker = "  app.use('/api/v1/admin',unifiedAdminRoutes);"; Anchor = "  app.use('/api/v1/admin',adminRoutes);" },
  @{ Marker = "  app.use('/api/v1/admin',crossAdminRoutes);"; Anchor = "  app.use('/api/v1/admin',instagramAdminRoutes);" }
)
$original = $content
foreach ($item in $needs) {
  if ($content.Contains($item.Marker)) { continue }
  if (!$content.Contains($item.Anchor)) { throw "Unexpected server.ts version: required anchor is missing: $($item.Anchor)" }
  $content = $content.Replace($item.Anchor, ($item.Anchor + "`n" + $item.Marker))
}
if (!$content.Contains('await ensureUnifiedSchema()')) { throw 'Missing schema repair guard. No modifications made.' }
if (!$content.Contains("app.use('/api/v1',publicRoutes)")) { throw 'Missing legacy routes. No modifications made.' }
if ($content -eq $original) { Write-Host 'All routes already registered; no changes needed.'; exit 0 }
$backup = "$target.pre-route-hotfix.bak"
Copy-Item -LiteralPath $target -Destination $backup -Force
[System.IO.File]::WriteAllText($target,$content,(New-Object System.Text.UTF8Encoding($false)))
Write-Host 'Repaired missing unified and cross-platform route imports/mounts.'
Write-Host "Backup saved locally: $backup"
Write-Host 'Next: cd Module_1_Adapter; npm test; npm run build'
