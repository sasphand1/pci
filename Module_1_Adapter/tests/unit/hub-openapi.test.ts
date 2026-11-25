import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { buildHubSpec, HUB_OPERATIONS } from '../../src/modules/ingest/openapi.ts';

const src = (f: string) => readFileSync(new URL(`../../src/modules/ingest/${f}`, import.meta.url), 'utf8');
const routes = [...(src('routes.ts') + src('read-routes.ts')).matchAll(/(?:ingestAdminRoutes|\br)\.(get|post|patch|put|delete)\('([^']+)'/g)]
  .map(m => `${m[1]} ${m[2].replace(/:([A-Za-z]+)/g, '{$1}')}`).sort();

test('every Data Hub route is documented and nothing undocumented is described', () => {
  assert.deepEqual(HUB_OPERATIONS.map(o => `${o.method} ${o.path}`).sort(), routes);
});
test('the checked-in document matches the code', () => {
  const file = JSON.parse(readFileSync(new URL('../../../docs/hub-openapi.json', import.meta.url), 'utf8'));
  assert.deepEqual(file, JSON.parse(JSON.stringify(buildHubSpec())));
});
test('write operations say who may call them', () => {
  for (const [p, item] of Object.entries<any>(buildHubSpec().paths))
    for (const [m, op] of Object.entries<any>(item)) if (m !== 'get') assert.ok(op.responses['403'] || /any admin/.test(op.description), `${m} ${p}`);
});
