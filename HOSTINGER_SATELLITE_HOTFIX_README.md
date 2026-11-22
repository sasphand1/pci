# PCI Satellite Hostinger hotfix — commit c59bfed

## Verified problem
The GitHub `main` tree at commit `c59bfed` includes `Module_1_Adapter/src/modules/satellite/service.ts` and satellite imports in `server.ts`/`scheduler.ts`, but omits `routes.ts`, `bulk.mjs`, `guard.mjs`, `catalog.mjs`, their TypeScript declarations, and migration `096_satellite.sql`. The existing production `scripts/copy-assets.mjs` does not include the three `.mjs` files.

## Fix included
Seven missing source/type files, migration `096_satellite.sql`, updated `scripts/copy-assets.mjs`, and four satellite test files. No existing creator, events, frontend or admin files are overwritten. The updated copy script **fails the build** if any required runtime `.mjs` source is missing.

## Apply
1. Back up or commit your working tree.
2. Extract this ZIP into the PCI repository root (the directory containing `Module_1_Adapter`).
3. Run from PCI root:

```powershell
npm --prefix Module_1_Adapter run build
if ($LASTEXITCODE -ne 0) { throw 'Backend build failed' }
npm --prefix Module_1_Adapter test
if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed' }
Get-ChildItem Module_1_Adapter/dist/modules/satellite
```

The `dist/modules/satellite` output must contain compiled `service.js`, `routes.js` and copied `bulk.mjs`, `guard.mjs`, `catalog.mjs`.

4. If all checks succeed, inspect `git status` and commit **only** the expected paths; then push.
5. Hostinger should redeploy the updated commit. Confirm its build logs show all three `Copied runtime module: modules/satellite/...` lines. Apply migrations through the existing PCI migration mechanism before enabling any satellite providers.

## Limits / important
This package fixes the **specific missing-module Hostinger failure**. It is not a declaration that satellite APIs are deployed end-to-end or that live NASA ingestion has been tested. Existing admin and public satellite pages in prior overlay ZIPs may still need staging/deployment, and providers default disabled. NASA credentials remain in Hostinger server-side environment configuration.

### Test evidence
The included `.mjs` parser, batch, guard and source-code contract tests have been run locally against the patched source tree. A full `npm run build` could not be rerun in this environment because the submitted inspection archive excluded `node_modules`/lockfiles. You must run the build in your Windows working tree or Hostinger before pushing.
