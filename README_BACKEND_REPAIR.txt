PCI MODULE 1 HOSTINGER 503 REPAIR

Root cause: src/modules/instagram/routes.ts imports ./ranking.mjs, while TypeScript
only emits .ts files and the previous copy-assets.mjs did not copy Instagram,
cross-platform, or unified runtime .mjs modules to dist.

This patch modifies exactly one source file:
  Module_1_Adapter/scripts/copy-assets.mjs

Extract into C:\Users\sasph\Documents\PCI_Clean, preserving folders and
replacing that one file. No .env, token, database, or frontend changes.

PowerShell verification BEFORE pushing:
  cd "C:\Users\sasph\Documents\PCI_Clean\Module_1_Adapter"
  npm run build
  @('instagram/ranking.mjs','cross-platform/score.mjs','unified/metrics.mjs') | ForEach-Object {
    if (!(Test-Path "dist/modules/$_")) { throw "Missing dist/modules/$_" }
  }
  node --input-type=module -e "await import('./dist/modules/instagram/ranking.mjs'); await import('./dist/modules/cross-platform/score.mjs'); await import('./dist/modules/unified/metrics.mjs'); console.log('Runtime MJS imports OK')"

Push ONLY Module 1 after verifying:
  cd ..
  git add Module_1_Adapter/scripts/copy-assets.mjs
  git diff --cached --check
  git commit -m "Fix production backend missing runtime MJS modules"
  git push origin main

Verify after Hostinger backend redeploy:
 https://traveled-blanchedalmond-woodpecker-58.hostingersite.com/health/ready
 https://traveled-blanchedalmond-woodpecker-58.hostingersite.com/api/v1/rankings?sort=views&limit=5

A green /health/ready checks DB and Redis; creator listing additionally confirms
original YouTube data. Do NOT re-import or alter API keys. If a new runtime error
appears, inspect fresh backend logs; no claim is made that this fixes unrelated
missing migrations or environment configuration.
