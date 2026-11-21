# Zip 5: glass management console, overview and session handling

## What changed for you
- **New look:** glass theme in indigo and aqua on frost white. One stylesheet: `Module_3_Admin_Panel/src/app/glass.css`.
- **Grouped menu:** Overview / Rankings (People, Pipeline, Categories) / Website (Page content, Live wall) / Administration (System health, Audit log, Team, My security, Settings). "Bucket" is now called People. Videos left the menu (the page file stays).
- **Overview page:** real numbers only. People, accounts, audience from fresh readings (max 7 days old), last publish, audience chart, pipeline state, "Needs attention", top of the wheel.
- **Status badge** in the top bar: All systems ok / Attention / Needs action. "Needs action" means the background worker has not been seen while the daily run is on.
- **Session handling** (details below).

## Session handling
| Rule | Where |
|---|---|
| Idle timeout 30 minutes (change with `ADMIN_IDLE_MINUTES`, 5 to 480) | Module 1 enforces it, the panel mirrors it |
| Absolute limit stays `ADMIN_SESSION_HOURS` (8) | Module 1 |
| Warning one minute before either end, with Stay signed in (idle only) | Module 3 |
| Browser polling never extends the session (header `X-Pci-Background`) | both |
| Any 401 returns to sign-in with "Your session ended" | Module 3 |
| Sign out in one tab signs out all tabs; sign in refreshes the others | Module 3 (BroadcastChannel, no storage) |
| Failed sign-in clears password and code; rate limit says "Too many attempts" | Module 3 |

Sessions created before this release have no stored end time. They fall back to the idle window only and last until it passes. Everyone simply signs in again after the deploy.

## Environment variables
Module 1 only, optional: `ADMIN_IDLE_MINUTES=30`. Nothing new for Module 2 or 3.

## Deploy order
1. Push the commit. Wait for CI (4 jobs) to be green.
2. Deploy **Module 1** first. Check `https://<api>/api/v1/admin/overview` after signing in (it needs the admin cookie, so check it through the panel).
3. Deploy **Module 3**.
4. Open the panel. Expect "Needs action" until `RUN_WORKER_IN_API=true` is set on Module 1 and the worker has started.

## Rollback
Redeploy the previous commit of Module 3 and Module 1. No database change is part of this zip.

## What was checked here
- Module 1: 138 unit tests pass (new: overview rules, session timing). Strict type check of the new pure files.
- Module 3: 32 tests pass (new: idle rules, chart geometry, formatting, navigation by role, session wiring, colour contrast read from the stylesheet). Type check of all source with stand-ins for React and Next. Deliberate breakages were caught by the tests.

## Not checked here (no database, no packages, no browser in this environment)
- The five database tests in `tests/integration/overview.test.ts` run in CI only.
- The real Next.js build and the screens in a real browser. Look at Overview, People and Pipeline once after deploying, on a phone width too.
- The server idle timeout against real Redis. Test: sign in, wait the idle time with the panel closed, reload. You should land on the sign-in screen.

## Commit exactly these files (PowerShell, from the repo root)
```powershell
git add .github/workflows/ci.yml docs/ZIP5_GLASS_CONSOLE.md
git add Module_1_Adapter/.env.example Module_1_Adapter/package.json Module_1_Adapter/src/lib/config.ts Module_1_Adapter/src/server.ts
git add Module_1_Adapter/src/modules/auth/auth.ts Module_1_Adapter/src/modules/auth/session.ts
git add Module_1_Adapter/src/modules/publish/routes.ts Module_1_Adapter/src/modules/publish/overview.ts Module_1_Adapter/src/modules/publish/overview-shape.ts
git add Module_1_Adapter/tests/integration/overview.test.ts Module_1_Adapter/tests/unit/overview-shape.test.ts Module_1_Adapter/tests/unit/session.test.ts
git add Module_3_Admin_Panel/src Module_3_Admin_Panel/tests
git status --short
git commit -m "Glass management console, overview and session handling"
git push
```
Check `git status --short` shows only these files before you commit.

## Hotfix notes (added after first CI run)
- **Deploy overlap on Hostinger:** the two modules may finish deploying in any order. The panel now copes with an older API: a quiet (polling) request that the browser blocks because of the `X-Pci-Background` header repeats once without it, and a 404 from `/admin/overview` shows "Module 1 is still updating" instead of an error. The old API only lacks the idle timeout until it finishes deploying. Ordinary requests are never retried, so real outages still show.
- **CI test fix:** the overview test's people only had follower numbers, so the Most Viewed and Most Active rankings failed their coverage gate and raised 2 alerts (correct behaviour). The test people now have all three metrics.
- **`onClick={x.reload}` type error:** `reload` takes `unknown`, only `true` means quiet.
