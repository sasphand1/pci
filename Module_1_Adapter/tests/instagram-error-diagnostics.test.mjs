import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyInstagramLookupError } from '../src/modules/bucket/instagram-error.mjs';
for (const [error, part] of [
  ['INSTAGRAM_GRAPH_ERROR_190', 'authentication failed'],
  ['INSTAGRAM_GRAPH_ERROR_10', 'permission denied'],
  ['INSTAGRAM_GRAPH_ERROR_100', 'eligibility is unconfirmed'],
  ['INSTAGRAM_GRAPH_ERROR_429', 'rate limit'],
  ['INSTAGRAM_GRAPH_ERROR_500', 'server error'],
  ['INSTAGRAM_GRAPH_NOT_CONFIGURED', 'not configured'],
  ['INSTAGRAM_GRAPH_INVALID_RESPONSE', 'incomplete']
]) {
  test(`lookup ${error} is not misclassified as an unsupported account`, () => {
    const r = classifyInstagramLookupError(new Error(error));
    assert.equal(r.reason, 'resolve_error');
    assert.match(r.hint, new RegExp(part, 'i'));
  });
}
