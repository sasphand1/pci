# Runs only on local files after ZIP extraction; NEVER contacts GitHub or Hostinger.
# Must be run from the PCI_Clean project root with PowerShell.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
function InsertOnce([string]$relative,[string]$marker,[string]$addition,[string]$sentinel) {
 $path = Join-Path $root $relative
 if (-not (Test-Path -LiteralPath $path)) { throw "Missing expected project file: $relative" }
 $content = [System.IO.File]::ReadAllText($path)
 if ($content.Contains($sentinel)) { Write-Host "Already patched: $relative"; return }
 if (-not $content.Contains($marker)) { throw "Version mismatch in ${relative}: cannot find insertion anchor. File unchanged." }
 $new = $content.Replace($marker,($addition + "`n" + $marker))
 [System.IO.File]::WriteAllText($path,$new,[System.Text.UTF8Encoding]::new($false))
 Write-Host "Patched: $relative"
}
InsertOnce 'Module_1_Adapter/src/server.ts' "import { createServer } from 'node:http';" "import {unifiedPublicRoutes,unifiedAdminRoutes} from './modules/unified/routes.js';" 'unifiedPublicRoutes,unifiedAdminRoutes'
InsertOnce 'Module_1_Adapter/src/server.ts' "  app.use('/api/v1',instagramPublicRoutes);" "  app.use('/api/v1',unifiedPublicRoutes);" "app.use('/api/v1',unifiedPublicRoutes)"
InsertOnce 'Module_1_Adapter/src/server.ts' "  app.use('/api/v1/admin',instagramAdminRoutes);" "  app.use('/api/v1/admin',unifiedAdminRoutes);" "app.use('/api/v1/admin',unifiedAdminRoutes)"
InsertOnce 'Module_3_Admin_Panel/src/lib/nav.ts' " {title:'Instagram creators',href:'/instagram',roles:['owner','editor']}," " {title:'Unified human review',href:'/unified',roles:['owner','editor']}," "href:'/unified',roles:"
InsertOnce 'Module_2_Public_Website/packages/ui/src/styles.css' "@import './styles/platform-rows.css';" "@import './styles/unified.css';" "@import './styles/unified.css'"
Write-Host 'Local patch complete. Run the tests and build BEFORE committing.'
