import test from 'node:test';
import assert from 'node:assert/strict';
import { containsLink } from '../../src/modules/wall/links.js';

test('links and link tricks are refused', () => {
  for (const bad of ['visit https://evil.example/login', 'http://x.y', 'WWW.evil.com', 'go to evil.com now', 'bit.ly/abc', 'wa.me/92300', 't.me/scam', 'claim at free-prize . com', 'evil dot com', 'evil(dot)com', 'evil[dot]com', 'javascript:alert(1)', 'sub.domain.example.org/path', 'ｅｖｉｌ．ｃｏｍ', 'mail me me@evil.com']) assert.equal(containsLink(bad), true, bad);
});
test('ordinary chat is allowed', () => {
  for (const good of ['Mooroo deserves #1!', 'Great ranking, thanks', 'I think 3.6M subscribers is impressive', 'Ducky Bhai vs Irfan Junejo?', 'Salam everyone. How are you', 'it is 10.5 million', 'Dr. Smith said hello.Nice', 'پاکستان زندہ باد']) assert.equal(containsLink(good), false, good);
});
