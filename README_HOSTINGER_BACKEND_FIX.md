# PCI Module 1 Hostinger 503 hotfix

**Root cause:** TypeScript compiled satellite/service.ts to dist/modules/satellite/service.js, which imports policy.mjs. The production asset copy script omitted policy.mjs, and Node crashed at startup with ERR_MODULE_NOT_FOUND.

## Included files
- Module_1_Adapter/scripts/copy-assets.mjs — copy policy.mjs and verify unresolved .mjs imports during build.
- Module_1_Adapter/tests/satellite-production-assets.test.mjs — regression checks.

## Apply
1. Extract ZIP contents into the root of PCI_Clean (overwrite matching files).
2. Run:

```powershell
npm --prefix Module_1_Adapter test
if ($LASTEXITCODE -ne 0) { throw "Module 1 tests failed" }
npm --prefix Module_1_Adapter run build
if ($LASTEXITCODE -ne 0) { throw "Module 1 build failed" }
Test-Path .\Module_1_Adapter\dist\modules\satellite\policy.mjs
```

The last command must return True. Then commit ONLY these two files:

```powershell
git add Module_1_Adapter/scripts/copy-assets.mjs Module_1_Adapter/tests/satellite-production-assets.test.mjs
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw "Git diff check failed" }
git commit -m "Fix missing satellite policy in Hostinger backend runtime"
if ($LASTEXITCODE -ne 0) { throw "Commit failed" }
git push origin main
if ($LASTEXITCODE -ne 0) { throw "Push failed" }
```

Deploy **Module 1** (traveled-blanchedalmond-woodpecker-58.hostingersite.com) on Hostinger, then verify:

```powershell
$api = "https://traveled-blanchedalmond-woodpecker-58.hostingersite.com"
Invoke-RestMethod "$api/health/live"
Invoke-RestMethod "$api/health/ready"
(Invoke-RestMethod "$api/api/v1/public/events").data | Measure-Object
```

No database migrations or event data modifications. The public site will populate only with approved, unexpired events actually returned by Module 1.
