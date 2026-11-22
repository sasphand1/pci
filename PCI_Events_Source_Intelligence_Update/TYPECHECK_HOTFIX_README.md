# PCI Events TypeScript hotfix

Fixes two errors reported by `npm run build` / `npm run typecheck`:

- `service.ts`: Narrow `value.item` before accessing its fields.
- `events/sources/page.tsx`: Make `onReview` callback return `Promise<void>` instead of `Promise<boolean>`.

Nothing else is modified. It backs up original versions in `.pci-events-ts-hotfix-backups` and is safe to re-run. No Git commands, deployments or data changes are performed.

From PowerShell in the `PCI_Clean` repository root, after downloading `APPLY_PCI_EVENTS_TYPECHECK_FIX.mjs` to Downloads:

```powershell
node "$env:USERPROFILE\Downloads\APPLY_PCI_EVENTS_TYPECHECK_FIX.mjs" "$PWD"

npm --prefix Module_1_Adapter run build
if ($LASTEXITCODE -ne 0) { throw 'Backend build failed' }

npm --prefix Module_3_Admin_Panel run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Admin typecheck failed' }
```

The event unit tests can be run again with:

```powershell
node --test Module_1_Adapter/tests/events-*.test.mjs
```

This hotfix cannot replace full production validation of live feeds, events DB and maps.
