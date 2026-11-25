import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../packages/ui/src/styles/creator-profile.css',import.meta.url),'utf8');
test('creator profile uses one explicit grid system with no ordinal spans',()=>{
 assert.doesNotMatch(css,/cp-two-grid:has|grid-column:\s*span|repeat\(12,/);
 assert.match(css,/\.cp-two-grid>\.cp-full-card\{grid-column:1\/-1\}/);
 assert.match(css,/container-name:profile-main/);
 assert.match(css,/@container profile-main \(min-width:720px\)/);
 assert.match(css,/@container profile-main \(max-width:379px\)/);
 assert.match(css,/\.cp-two-grid:empty\{display:none\}/);
});
