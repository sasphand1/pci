# PCI Events Compact Red Pins — targeted update

## Scope

Patch only `Module_2_Public_Website/public/events-radar.html`. This ZIP uses a guarded installer because it is safer to edit the existing 300 KB Events page in place than to replace its live categories, API wiring, map handlers, or accessibility features with a stale full-file snapshot.

- 10-pixel spherical red blinking head, thin 9-pixel gray stem; not a giant diamond.
- No permanently displayed event labels. Event name appears on hover/focus/selection; existing event details remain clickable.
- All 10 published category tabs continue to filter the real `/api/events` response and now re-center on the filtered set.
- Existing city and search filters, OpenFreeMap/MapLibre, Waze links, and events table are retained.
- Reject coordinates outside the coarse Pakistan bounding area before plotting. This is a bounding box, not official national-border verification.
- No synthetic events are added. Accurate coverage depends on approved records and source feeds in Module 1; no frontend patch can guarantee that all events in Pakistan have been discovered.
- Original HTML is backed up locally as `events-radar.html.before-compact-pins.bak` (do not commit backup).

## Run from `C:\Users\sasph\Documents\PCI_Clean`

Extract this ZIP directly into `PCI_Clean` (the three files should be in the repository root). Then run:

```powershell
node .\APPLY_PCI_EVENTS_COMPACT_PINS.mjs
npm --prefix Module_2_Public_Website test
if ($LASTEXITCODE -ne 0) { throw 'Tests failed — do not push' }
npm --prefix Module_2_Public_Website run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed — do not push' }
git add Module_2_Public_Website/public/events-radar.html Module_2_Public_Website/tests/events-compact-pins.test.mjs
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw 'Git whitespace check failed — do not push' }
git commit -m 'Replace oversized Events diamonds with compact red map pins'
if ($LASTEXITCODE -ne 0) { throw 'Commit failed' }
git push origin main
if ($LASTEXITCODE -ne 0) { throw 'Push failed' }
```

### Deploy

Redeploy only `Module_2_Public_Website` on Hostinger to the new commit, and hard refresh `/events` (Ctrl+Shift+R). Module 1 doesn't need to be redeployed for this presentation-only change.

## Verification

1. Small red headed pins are present, with name shown on hover rather than across the map.
2. All Events shows all eligible, published events with valid Pakistan coordinates.
3. Each category returns only approved events in that category (zero if no approved records).
4. City and search filters further reduce results.
5. Clicking a pin opens correct event details and venue location.
6. Events table remains intact.

This bundle has not been executed against the complete local repository or Hostinger. Run the included full tests and build before deploying. No claim is made that all real-life events have been ingested.
