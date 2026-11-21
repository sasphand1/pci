import test from 'node:test';
import assert from 'node:assert/strict';
import { ENDPOINTS, openapiPath, registerEndpoints } from '../../src/modules/public/endpoints.js';
import { buildSpec, schemas } from '../../src/modules/public/openapi.js';

const spec: any = buildSpec();
const walk = (x: unknown, f: (o: any) => void) => { if (Array.isArray(x)) x.forEach(v => walk(v, f)); else if (x && typeof x === 'object') { f(x); Object.values(x).forEach(v => walk(v, f)); } };

test('router and documentation are built from the same list', () => {
  const fake = { routes: [] as string[], get(p: string) { this.routes.push(p); } };
  const handlers = Object.fromEntries(ENDPOINTS.map(e => [e.id, () => 0]));
  registerEndpoints(fake, handlers);
  assert.deepEqual(fake.routes, ENDPOINTS.map(e => e.path));
  assert.deepEqual(Object.keys(spec.paths).sort(), ENDPOINTS.map(e => openapiPath(e.path)).sort());
});
test('a handler without documentation, or documentation without a handler, stops start-up', () => {
  const r = { get() {} };
  const all = Object.fromEntries(ENDPOINTS.map(e => [e.id, () => 0]));
  assert.throws(() => registerEndpoints(r, { ...all, secret: () => 0 }), /no documented endpoint/);
  const { status, ...rest } = all; void status;
  assert.throws(() => registerEndpoints(r, rest), /no handler/);
});
test('ids and paths are unique, and every path parameter is declared', () => {
  assert.equal(new Set(ENDPOINTS.map(e => e.id)).size, ENDPOINTS.length);
  assert.equal(new Set(ENDPOINTS.map(e => e.path)).size, ENDPOINTS.length);
  for (const e of ENDPOINTS) {
    const inPath = [...e.path.matchAll(/:([A-Za-z]+)/g)].map(m => m[1]).sort();
    assert.deepEqual(e.params.filter(p => p.in === 'path').map(p => p.name).sort(), inPath, e.id);
    for (const p of e.params.filter(p => p.in === 'path')) assert.equal(p.required, true, `${e.id}.${p.name}`);
  }
});
test('every $ref points at a schema that exists', () => {
  const refs: string[] = []; walk(spec, o => { if (typeof o.$ref === 'string') refs.push(o.$ref); });
  assert.ok(refs.length > 10);
  for (const r of refs) assert.ok(schemas[r.replace('#/components/schemas/', '')], r);
});
test('every operation is a read-only GET with OK and rate-limit answers', () => {
  for (const [p, item] of Object.entries<any>(spec.paths)) {
    assert.deepEqual(Object.keys(item), ['get'], p);
    assert.ok(item.get.responses['200'] && item.get.responses['429'], p);
    assert.ok(item.get.summary && item.get.description, p);
  }
});
test('endpoints with an unknown-item case document 404 and those with input document 400', () => {
  for (const e of ENDPOINTS) { const r = spec.paths[openapiPath(e.path)].get.responses; if (e.notFound) assert.ok(r['404'], e.id); if (e.params.length) assert.ok(r['400'], e.id); }
});
test('the document says what the numbers are', () => assert.match(spec.info.description, /not unique people/));
