# PCI Satellite Operations Test Report

## Targeted new regression tests

Command: `node --test Module_1_Adapter/tests/satellite-operations.test.mjs Module_2_Public_Website/tests/satellite-map-operations.test.mjs` (run from PCI root)

Exit: **0**

```text
TAP version 13
# Subtest: enabling a supported provider queues ingestion automatically, and disabling clears pending work
ok 1 - enabling a supported provider queues ingestion automatically, and disabling clears pending work
  ---
  duration_ms: 1.393101
  type: 'test'
  ...
# Subtest: POWER never reports partial ingestion as a complete successful refresh
ok 2 - POWER never reports partial ingestion as a complete successful refresh
  ---
  duration_ms: 0.346793
  type: 'test'
  ...
# Subtest: sources disclose queue and observation freshness, not secret keys
ok 3 - sources disclose queue and observation freshness, not secret keys
  ---
  duration_ms: 0.346072
  type: 'test'
  ...
# Subtest: satellite map reuses existing Events map library and basemap without changing Events
ok 4 - satellite map reuses existing Events map library and basemap without changing Events
  ---
  duration_ms: 1.06108
  type: 'test'
  ...
# Subtest: satellite city loads go through same-origin proxy, not browser-facing API credentials
ok 5 - satellite city loads go through same-origin proxy, not browser-facing API credentials
  ---
  duration_ms: 0.295197
  type: 'test'
  ...
1..5
# tests 5
# suites 0
# pass 5
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 75.454918

```

## Regression tests in reconstructed inspection tree
The new overlay was applied on top of the previously uploaded PCI inspection tree. Backend Satellite suite: **27/27 passed**. Frontend Satellite suite: **5/5 passed**. These are unit/source-contract tests, not a full Hostinger deployment test.

## Static checks
- Modified `.ts` and `.tsx` files parsed with TypeScript 5.x: **0 syntax diagnostics**.
- Satellite map embedded JavaScript `node --check`: **pass**.
- A live browser map test and upstream data tests have not been run.

## Full-system verification limits
The user's latest full repository, installed dependencies, Hostinger environment variables and production database are **not available in this runtime**. Local root-level source is an earlier inspection snapshot, with changes assembled from the present overlay. Consequently TypeScript typechecking, complete Next.js production builds, PostgreSQL integration and live upstream ingestion have **not** been executed here. These must pass before pushing to Hostinger.

## Commands to run from the PCI root on Windows
```powershell
$ErrorActionPreference = 'Stop'
foreach ($module in @('Module_1_Adapter','Module_2_Public_Website','Module_3_Admin_Panel')) {
 npm --prefix $module test
 if ($LASTEXITCODE -ne 0) { throw "$module tests failed" }
 npm --prefix $module run build
 if ($LASTEXITCODE -ne 0) { throw "$module build failed" }
}
```
