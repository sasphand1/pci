# PCI Satellite V3 test report

Environment: isolated Linux container with Node.js 22; reconstructed PCI source from the provided inspection ZIP plus earlier overlay. External network calls to live providers were not available in the container.

## Completed

- **12/12** new deterministic backend ingestion/validation tests passed (EONET, Copernicus, GIBS, GPM, source allowlists, SQL batching, no fabricated metrics).
- **4/4** new website integration checks passed (same-origin proxy, MapLibre reused, no Events iframe modification, honest science labels).
- Backend reconstructed legacy+new `node --test tests/*.test.mjs`: **105/106 passed**. The single failure is `structure.test.mjs` requiring `.env.example`, excluded from the inspection ZIP. It is not introduced by the overlay.
- Website reconstructed `node --test tests/*.test.mjs`: **47/52 passed**. Five failures require existing `categories/[slug]/page.tsx`, `creators/[slug]/page.tsx`, and `public/images/islamabad-dusk.webp`, absent from the inspection ZIP. They are not introduced by the overlay.
- Existing Module 3 management tests: **39/39 passed**. No admin source files changed.
- TypeScript/TSX **syntax diagnostics: zero** for all five modified .ts/.tsx sources (via TypeScript transpileModule).
- Satellite MapLibre inline script: `node --check` passed.

## Not certified

- Complete `npm run build` for all modules (inspection archive excludes dependency installation/lockfiles and some original assets).
- PostgreSQL `098` migration executed against real Postgres and concurrent deployment processes.
- Live NASA EONET/GIBS/GPM and Copernicus OData responses; mock fixture tests are not live HTTP tests.
- Hostinger scheduled execution, staging load tests, and tile usage quotas.

## Required deployment gate

On the full Windows PCI checkout, run `VERIFY_PCI_SATELLITE.ps1`, then inspect GitHub Actions and Hostinger worker/provider status. No push is performed by the script. Do not infer successful real ingestion from a compilation pass alone.
