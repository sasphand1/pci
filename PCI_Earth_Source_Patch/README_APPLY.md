# PCI Earth Intelligence — source integration patch (review build)

**Base:** Current `sasphand1/pci` main structure as inspected November 22, 2026 (head `9c7a5676`). This is a guarded *local patch*, not a deployed release. It does not touch Events, rankings, or existing creator APIs.

## Implemented

- A real **USGS ComCat earthquake report** adapter: strictly bounded official FDSN GeoJSON fetch, parser, ingestion into existing PostgreSQL Satellite observations, owner-controlled enable/refresh on existing scheduler (minimum 60 minutes), and published report endpoint `/api/v1/satellite/earthquakes/latest`.
- Same-origin website proxy `?metric=earthquakes` and report summary in **Disasters** and **Discover** categories. USGS reports are post-event seismic catalog records, **not satellites detecting or predicting earthquakes**, not earthquake early warnings, and not guaranteed complete. The search bounding box includes parts of neighboring countries.
- Four **disabled, explicitly unimplemented** provider entries in the management panel and database for Landsat thermal, NASA ECOSTRESS, NASA SMAP soil moisture, and NASA VIIRS Black Marble. They CANNOT be enabled until proper Earthdata authorization, ingestion, raster processing, scientific quality control, and validated summaries are built. No invented surface temperatures, soil readings, farm diagnoses, or nighttime economic claims.
- Idempotent `099_earth_science_sources.sql` migration added to the existing runtime bootstrap. No destructive table modifications.
- Regression checks for USGS query/parser, fail-closed NASA providers, migration registration, batch persistence, and official-source claims.

## Verification completed here

- Backend focused regression tests: **27 passed**.
- Satellite frontend focused tests: **9 passed**.
- Admin focused tests: **2 passed**.
- The current live GitHub checkout was not available in the test container. Full-module tests/builds **must be run on your Windows checkout**. No GitHub push occurred: the connected GitHub app returned HTTP 403 for branch creation.

## Safe application on Windows PowerShell

1. Open PowerShell and enter your PCI working directory:

   ```powershell
   cd C:\Users\sasph\Documents\PCI_Clean
   git fetch origin
   git switch main
   git pull --ff-only origin main
   git switch -c feature/earth-intelligence-sources
   ```

2. Extract the downloaded ZIP into **another folder** (not into PCI_Clean). The ZIP contains this README, `APPLY_PCI_EARTH_SOURCES.mjs`, and test logs.

3. Point the script path to wherever you extracted it, then run the dry-run. Example for an extracted folder in Downloads:

   ```powershell
   node "$HOME\Downloads\PCI_Earth_Source_Patch\APPLY_PCI_EARTH_SOURCES.mjs" . --dry-run
   ```

   **Do not continue** if this reports an unexpected PCI version or missing anchor.

4. Apply the patch using the same script without `--dry-run`:

   ```powershell
   node "$HOME\Downloads\PCI_Earth_Source_Patch\APPLY_PCI_EARTH_SOURCES.mjs" .
   ```

   The script first validates **every** expected anchor, then backs up changed files in `.pci-earth-source-backups/<timestamp>/`. It does not remove existing backup folders. If applying fails mid-write because of disk errors, recover from this backup before proceeding.

5. Run the **complete** tests and builds:

   ```powershell
   npm --prefix Module_1_Adapter test
   if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed: DO NOT PUSH' }
   npm --prefix Module_1_Adapter run build
   if ($LASTEXITCODE -ne 0) { throw 'Backend build failed: DO NOT PUSH' }
   npm --prefix Module_2_Public_Website test
   if ($LASTEXITCODE -ne 0) { throw 'Public website tests failed: DO NOT PUSH' }
   npm --prefix Module_2_Public_Website run build
   if ($LASTEXITCODE -ne 0) { throw 'Public website build failed: DO NOT PUSH' }
   npm --prefix Module_3_Admin_Panel test
   if ($LASTEXITCODE -ne 0) { throw 'Admin tests failed: DO NOT PUSH' }
   npm --prefix Module_3_Admin_Panel run build
   if ($LASTEXITCODE -ne 0) { throw 'Admin build failed: DO NOT PUSH' }
   git diff --check
   if ($LASTEXITCODE -ne 0) { throw 'Git whitespace check failed: DO NOT PUSH' }
   ```

6. Only after all pass, inspect the changed files and stage **only these 15 intended files**:

   ```powershell
   git add -- Module_1_Adapter/src/modules/satellite/catalog.mjs Module_1_Adapter/src/modules/satellite/policy.mjs Module_1_Adapter/src/modules/satellite/bulk.mjs Module_1_Adapter/src/modules/satellite/bulk.d.mts Module_1_Adapter/database/migrations/099_earth_science_sources.sql Module_1_Adapter/src/lib/satellite-schema.ts Module_1_Adapter/src/modules/satellite/feeds.mjs Module_1_Adapter/src/modules/satellite/feeds.d.mts Module_1_Adapter/src/modules/satellite/service.ts Module_1_Adapter/src/modules/satellite/routes.ts Module_2_Public_Website/src/app/api/satellite/route.ts Module_2_Public_Website/src/components/SatelliteDashboard.tsx Module_3_Admin_Panel/src/app/satellite/page.tsx Module_1_Adapter/tests/satellite-catalog.test.mjs Module_1_Adapter/tests/earth-science-sources.test.mjs
   git diff --cached --check
   git diff --cached --stat
   git commit -m 'Add USGS earthquake reports and register future NASA scientific sources'
   git push -u origin feature/earth-intelligence-sources
   ```

   Review GitHub CI and open a Pull Request into `main`. **Do not push this to main directly.** If a test fails, share the full error output before committing.

## After deploying successfully

Only then should an Owner open the existing **Satellite APIs** management panel and enable **USGS Earthquake Reports**. It starts disabled; no data will appear until ingested successfully. All four NASA scientific providers are visible but locked as `Connector not implemented`.

## Important scope

This update does **not** yet implement real Landsat/ECOSTRESS/SMAP/Black Marble ingestion and raster analytics, earthquake notification subscriptions, signup/API keys, seismic early warning, or automated farm/land diagnosis. Those are separate engineering and validation milestones. The current website's design/layout is preserved rather than rewritten as part of this source integration.
