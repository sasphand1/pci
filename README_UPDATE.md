# Pakistan Creator Index — Ranking V1.0 Update (overlay)

## What this is
A **source overlay** for the three existing modules. Extract this archive into the folder containing `Module_1_Adapter`, `Module_2_Public_Website`, and `Module_3_Admin_Panel` (e.g. `C:\Users\sasph\Documents\PCI_Clean`). Do **not** put it inside any single module. Existing files with the same relative paths are replaced.

This ZIP intentionally does **not** include environment files, Docker volumes, node_modules, the shared UI package, or `next.config.ts`. It preserves your machine-specific port 8081/CSP fix and Redis import fix. It does not install dependencies.

## What changed
- **Module 1:** Keep existing BigInt-safe subscriber/views/videos rankings. Attach per-metric known/unavailable counts and publication timestamp to `/api/v1/rankings`. Report coverage in the admin ranking preview. Safeguard summary handling when a field is absent. Add unit tests for unavailable-versus-zero and invalid metric names.
- **Module 2:** Show ranking scope, coverage, and last published timestamp on the Rankings page, with no page-specific CSS.
- **Module 3:** Show coverage information alongside the ranking preview; no new editable algorithm or advanced ranking switch.
- **No database migrations; no API breaking changes.** Existing requests continue to work; ranking responses gain optional `meta.coverage` and `meta.asOf` fields.

## Install on Windows PowerShell (from the PCI_Clean root)
First stop running `npm run dev` windows with Ctrl+C in Module 2 and Module 3. Docker containers can stay up during extraction; rebuild afterward.

```powershell
cd C:\Users\sasph\Documents\PCI_Clean
# Safeguard current source before overwriting. The following backup includes local source,
# not dependencies; ensure your private .env files remain securely stored.
$backup = Join-Path $env:TEMP ('pci-source-backup-' + (Get-Date -Format yyyyMMdd-HHmmss))
New-Item -ItemType Directory -Path $backup | Out-Null
foreach ($m in 'Module_1_Adapter','Module_2_Public_Website','Module_3_Admin_Panel') {
  Copy-Item -Recurse -Path ".\$m\src" -Destination (Join-Path $backup "${m}-src")
}
Write-Host "Source backup: $backup"
# Download the V1.0 update zip to Downloads, then:
Expand-Archive -Path "$env:USERPROFILE\Downloads\PCI_V1_0_Ranking_Update.zip" -DestinationPath . -Force
```

### Backend — build and test
```powershell
cd .\Module_1_Adapter
docker compose build api worker migrate
npm install
npm test
# Then restart:
docker compose up -d --force-recreate api worker
curl.exe http://localhost:8081/health/ready
cd ..
```

Run `npm test` from the source folder; production Docker images do not include the tests.

### Frontends — restart
```powershell
cd .\Module_2_Public_Website
npm install
npm test
npm run dev
```
Open a NEW terminal:
```powershell
cd C:\Users\sasph\Documents\PCI_Clean\Module_3_Admin_Panel
npm install
npm test
npm run dev
```

Both frontends must use their current `.env.local` settings with Module 1 at **http://localhost:8081**. Do not overwrite `.env.local`.

### Live results
In another PowerShell terminal, from `PCI_Clean`:
```powershell
.\TEST_V1.ps1
```
Expected: API ready, frontend pages HTTP 200, `/api/v1/rankings` includes `meta.coverage`, `meta.asOf`, and the selected raw sort. Zero creators is a *valid empty result* until you register channels and run YouTube sync. Verify displayed counts against a fresh YouTube API response before publicly claiming accuracy.

## Test status
Dependency-free unit/source suites passed: backend 23/23, public 9/9, admin 12/12. TypeScript compilation, Docker integration, API keys, live channel import, and end-to-end browser login **not tested in this environment**. Do not call this a production-certified release without those checks.

## Policy boundary
No H-index, TOPSIS, Bayesian creator score, hidden composite winner selection, or gamified competition is introduced. Public ordering remains raw YouTube subscriber counts, channel views, or video counts. This is a conservative policy-oriented release, not a guarantee of legal compliance.
