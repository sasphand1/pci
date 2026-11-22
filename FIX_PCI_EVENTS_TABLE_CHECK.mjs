/**
 * PCI public-site regression test correction (2026-11-22).
 * Fixes exactly one stale Satellite test expectation; changes no app/runtime files.
 * Usage: node FIX_PCI_EVENTS_TABLE_CHECK.mjs <PCI repository root>
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || process.cwd());
const testFile = path.join(root, 'Module_2_Public_Website', 'tests', 'satellite-map-operations.test.mjs');
const dashboardFile = path.join(root, 'Module_2_Public_Website', 'src', 'components', 'SatelliteDashboard.tsx');
const proxyFile = path.join(root, 'Module_2_Public_Website', 'src', 'app', 'api', 'satellite', 'route.ts');
const fail = message => { throw new Error(message); };

for (const f of [testFile, dashboardFile, proxyFile]) {
  if (!fs.existsSync(f)) fail(`Missing expected PCI file: ${path.relative(root,f)}. No files modified.`);
}
const dashboard = fs.readFileSync(dashboardFile,'utf8');
const proxy = fs.readFileSync(proxyFile,'utf8');
const source = fs.readFileSync(testFile,'utf8');

// Verify that the code really implements same-origin city lookups before updating the contract test.
if (!dashboard.includes("const API='/api/satellite'") ||
    !dashboard.includes('fetch(`${API}?metric=') ||
    /http:\/\/localhost:8080/.test(dashboard) ||
    !proxy.includes('ADAPTER_INTERNAL_URL') ||
    !proxy.includes('INVALID_FILTER')) {
  fail('Dashboard/proxy do not match the expected same-origin implementation; no files modified.');
}

// The original test name describes same-origin requests. The queued-refresh UI assertion
// is from an unrelated feature and is not a valid test of that behavior.
const staleExpectation = String.raw`/power\?\.refreshQueued/`;
const meaningfulExpectation = String.raw`/fetch\(\x60\$\{API\}\?metric=/`;
if (source.includes(meaningfulExpectation) && !source.includes(staleExpectation)) {
  console.log('Already corrected. No changes made.');
  process.exit(0);
}
const occurrences = source.split(staleExpectation).length - 1;
if (occurrences !== 1) {
  fail(`Expected exactly one stale queued-refresh assertion, found ${occurrences}; no files modified.`);
}
const updated = source.replace(staleExpectation, meaningfulExpectation);
if (updated === source || !updated.includes(meaningfulExpectation)) fail('Could not verify replacement; no files modified.');

const backupFile = `${testFile}.before-pci-check-fix`;
if (!fs.existsSync(backupFile)) fs.copyFileSync(testFile,backupFile,fs.constants.COPYFILE_EXCL);
fs.writeFileSync(testFile,updated,'utf8');
console.log('Corrected the stale same-origin proxy test expectation.');
console.log('No runtime code was changed.');
console.log('Backup:',path.relative(root,backupFile));
