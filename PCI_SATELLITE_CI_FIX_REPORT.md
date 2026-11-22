# PCI CI missing-files recovery — 2026-11-22

## Verified GitHub Actions errors
- Module 2: import `./styles/satellite.css` absent in repository; Next.js Turbopack build fails.
- Module 3: navigation contains `/satellite`, but `src/app/satellite/page.tsx` absent; `glass-shell.test.mjs` fails on no page for `/satellite`.
- Module 1: passed in GitHub run 44982228380.

## Files included
- `Module_2_Public_Website/packages/ui/src/styles/satellite.css`
- `Module_2_Public_Website/src/app/satellite/page.tsx`
- `Module_2_Public_Website/src/components/SatelliteDashboard.tsx` (required by page import)
- `Module_3_Admin_Panel/src/app/satellite/page.tsx`

All four are from the earlier V2 integration package. No global styles, server modules or navigation files are overwritten. Existing `@pci/ui` stylesheet and admin `nav.ts` already reference these missing files/routes.

## Installation
Extract over PCI repository **root** preserving paths. Review `git status` and stage only these four files and this report if desired. Do not overwrite other files.

## Verification on complete checkout
```powershell
npm --prefix Module_2_Public_Website run check
if ($LASTEXITCODE -ne 0) { throw 'Module 2 failed' }
npm --prefix Module_3_Admin_Panel run check
if ($LASTEXITCODE -ne 0) { throw 'Module 3 failed' }
```
If `check` is not defined for Module 3, use `npm --prefix Module_3_Admin_Panel run typecheck`, then `npm --prefix Module_3_Admin_Panel test`, then `npm --prefix Module_3_Admin_Panel run build`. Check each exit code.

## Scope and limitations
This patch repairs the two exact missing-file errors from CI run 44982228380. Structural validation of the overlay passed, but full Next.js builds and live API/runtime integration were not executed in this workspace. Do not claim CI success until a new Actions run passes.
