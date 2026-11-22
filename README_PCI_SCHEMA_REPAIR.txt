PCI UNIFIED HUMAN REVIEW — SAFE SCHEMA REPAIR

Scope: Module 1 backend ONLY. No direct GitHub modifications.
Cause supported by source and symptoms: unified admin endpoint reads human_review_status
and human_reviewed_* columns introduced in migration 090; backend startup did not run it.
The absence of columns is a strong diagnosis, not a confirmed SQL error until deployed.

Files:
- Module_1_Adapter/src/server.ts (startup schema guard)
- Module_1_Adapter/src/lib/unified-schema.ts (new, additive compatibility bridge)
- Module_1_Adapter/database/migrations/090_unified_human_creator.sql (idempotent migration)
- Module_1_Adapter/tests/unified-schema-startup.test.mjs (guard tests)

Installation: unzip at C:\Users\sasph\Documents\PCI_Clean, preserving folder hierarchy.
PowerShell:
 cd 'C:\Users\sasph\Documents\PCI_Clean\Module_1_Adapter'
 npm test
 npm run build
 node --input-type=module -e "await import('./dist/modules/unified/metrics.mjs'); await import('./dist/modules/instagram/ranking.mjs'); console.log('runtime imports OK')"
 cd ..
 git add Module_1_Adapter
 git diff --cached --check
 git diff --cached --name-only
 git commit -m "Repair unified creator schema on backend startup"
 git push origin main

On Hostinger, redeploy Module 1. Check health/ready, then admin /unified.
The startup repair runs on the existing Postgres database; it only adds missing
columns/indexes and never changes existing creator status or counts. It never
calls YouTube or Instagram APIs. If schema repair fails, the legacy backend
continues starting and the runtime log gives the real SQL error.

IMPORTANT: This does not auto-approve existing records. In admin /unified,
approve only actual individual humans before their unified ranks become visible.
If this initial cause is wrong, capture the 'request failed' log (error fields)
from the backend after reloading /unified. Do not reimport or run YouTube sync.
