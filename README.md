# PCI Wall security and indexing hardening

Base GitHub commit inspected: `dafcf6ab05e1300e76b98473ae69a133f9e39ae6`.

This package changes ONLY five exact paths. It uses an isolated worktree and will stop if another team updates any of those paths. It does not remove messages, alter admin moderation or change any secrets.

## Changes
- `Module_2_Public_Website/src/app/robots.ts`: do not disallow `/wall`, `/account`, `/verify-email`, `/reset-password` because those pages already publish `noindex` meta/HTTP directives. Continue to disallow `/api/` and `/admin/`.
- `Module_1_Adapter/src/modules/wall/links.ts`: add a pure filter for old stored posts containing links.
- `Module_1_Adapter/src/modules/wall/service.ts`: filter unsafe historical posts from public `/wall/messages` (not from authenticated admin moderation, and no database deletion).
- Two regression tests for the above behavior.

## Install
Extract the ZIP. From Windows PowerShell:

`& powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<extracted-folder>\\Deploy-PCI-Wall-Hardening.ps1" -Repo "C:\\Users\\sasph\\Documents\\PCI_Clean"`

The installer fetches current main, verifies the exact Git blob IDs and ZIP integrity, runs `npm ci` and `npm run check` for Module 1 and Module 2, stages ONLY modified paths, commits and pushes non-force. Other team worktrees are unaffected. After it succeeds, redeploy Hostinger Module 1 and Module 2.

`& powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<extracted-folder>\\Verify-PCI-Wall.ps1"`

It verifies live Googlebot-style noindex headers and crawl directives. A spoofed user-agent is NOT Google's actual inspection service. Run Google Search Console URL Inspection on `/wall`, then request security review separately after all site issues are addressed.

## Tests
Package author runs feasible unit and static tests. Full npm production checks are run by the installer because dependencies cannot be installed in the package-author environment. Do NOT claim this patch guarantees clearing Search Console's Deceptive Pages warning.
