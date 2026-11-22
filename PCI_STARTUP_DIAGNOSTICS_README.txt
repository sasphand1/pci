PCI targeted Hostinger startup and diagnostics patch (2026-11-19)

WHAT IT DOES
- Starts listening before DB/schema/Redis network initialization, avoiding Hostinger 3-second listen warning.
- Returns 503 SERVICE_INITIALIZING until DB and Redis are ready; /health/live always reports socket liveness.
- Preserves all existing unified, cross-platform, Instagram and YouTube routes.
- Adds sanitized per-route error diagnostics with SQLSTATE when request failures occur.
- Keeps existing schema bridge; no destructive migration or data import.

INSTALL
Extract ZIP into C:\Users\sasph\Documents\PCI_Clean and run:
  powershell -ExecutionPolicy Bypass -File .\APPLY_PCI_STARTUP_DIAGNOSTICS.ps1

VALIDATE (do not push if failure)
  cd Module_1_Adapter
  npm test
  npm run build

CHECK
  Test-Path .\dist\modules\instagram\ranking.mjs
  Test-Path .\dist\modules\unified\metrics.mjs

PUSH BACKEND ONLY
  cd ..
  git add Module_1_Adapter/src/server.ts Module_1_Adapter/src/lib/errors.ts
  git diff --cached --check
  git diff --cached
  git commit -m "Fix Hostinger startup sequencing and log API failures"
  git push origin main

AFTER DEPLOYMENT
  Open /health/live and /health/ready on backend. If any request still produces 500, Hostinger Runtime Logs will show [PCI_API_FAILURE] including request path and SQLSTATE. This patch deliberately does not guess the cause of those 500s.

ROLLBACK
Restore matching .backup_<timestamp> files created by installer and rebuild, OR revert only this commit using Git.
