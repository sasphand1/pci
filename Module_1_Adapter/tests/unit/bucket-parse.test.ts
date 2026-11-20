import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYoutubeInput, parseInstagramInput, parseBulk, slugify, uniqueSlug, normalizeName, MAX_BULK_ROWS } from '../../src/modules/bucket/parse.js';

const UC = 'UC' + 'a'.repeat(22);
test('YouTube: handle forms all normalise to the same handle', () => {
  for (const s of ['@DuckyBhai', 'duckybhai', 'https://www.youtube.com/@DuckyBhai', 'youtube.com/@DuckyBhai', 'https://m.youtube.com/@DuckyBhai?si=x', ' @duckybhai '])
    assert.deepEqual(parseYoutubeInput(s), { ok: true, kind: 'handle', value: 'duckybhai' }, s);
});
test('YouTube: channel ids from bare id and /channel/ links', () => {
  assert.deepEqual(parseYoutubeInput(UC), { ok: true, kind: 'channel_id', value: UC });
  assert.deepEqual(parseYoutubeInput(`https://youtube.com/channel/${UC}`), { ok: true, kind: 'channel_id', value: UC });
});
test('YouTube: legacy links, other sites, junk and short ids are invalid_format with a hint', () => {
  for (const s of ['https://youtube.com/c/Name', 'https://youtube.com/user/Name', 'https://example.com/@x', '', '   ', '@a', 'bad handle', 'https://youtube.com/channel/UCshort', 'https://youtube.com/watch?v=abc'] ) {
    const r = parseYoutubeInput(s); assert.equal(r.ok, false, s); if (!r.ok) assert.ok(r.hint.length > 3);
  }
});
test('Instagram: username forms normalise and lowercase', () => {
  for (const s of ['@Some.User_1', 'some.user_1', 'https://www.instagram.com/Some.User_1/', 'instagram.com/some.user_1?igsh=abc'])
    assert.deepEqual(parseInstagramInput(s), { ok: true, kind: 'username', value: 'some.user_1' }, s);
});
test('Instagram: posts, reels, explore, other hosts and bad characters are rejected', () => {
  for (const s of ['https://instagram.com/p/ABC/', 'https://instagram.com/reel/ABC/', 'https://instagram.com/explore/', 'https://example.com/user', 'bad name', 'a'.repeat(31), '', 'https://instagram.com/'])
    assert.equal(parseInstagramInput(s).ok, false, s);
});
test('bulk: lines split into account, person, niche; blanks and comments ignored; line numbers kept', () => {
  const r = parseBulk('# header\n\n@one, Person One, Gamer\r\ntwo\n  three ,, cooking ');
  assert.equal(r.tooMany, false);
  assert.deepEqual(r.rows.map(x => [x.index, x.line, x.raw, x.person, x.niche]), [[0, 3, '@one', 'Person One', 'gamer'], [1, 4, 'two', undefined, undefined], [2, 5, 'three', undefined, 'cooking']]);
});
test('bulk: row cap is enforced at exactly the limit', () => {
  const ok = parseBulk(Array.from({ length: MAX_BULK_ROWS }, (_, i) => `h${i}abc`).join('\n'));
  assert.equal(ok.rows.length, MAX_BULK_ROWS); assert.equal(ok.tooMany, false);
  assert.equal(parseBulk(Array.from({ length: MAX_BULK_ROWS + 1 }, (_, i) => `h${i}abc`).join('\n')).tooMany, true);
});
test('slugs: ascii, accents stripped, fallback, uniqueness suffixes', () => {
  assert.equal(slugify('Ducky Bhai!', 'x'), 'ducky-bhai');
  assert.equal(slugify('Zoë Ünal', 'x'), 'zoe-unal');
  assert.equal(slugify('رجب بٹ', 'rajab_butt'), 'rajab-butt');
  assert.equal(slugify('!', ''), 'creator');
  const taken = new Set(['a-b']);
  assert.equal(uniqueSlug('a-b', taken), 'a-b-2'); assert.equal(uniqueSlug('a-b', taken), 'a-b-3'); assert.ok(taken.has('a-b-3'));
});
test('normalizeName ignores case, accents, spacing and punctuation but nothing else', () => {
  assert.equal(normalizeName('Ducky  Bhai'), normalizeName('ducky-bhai'));
  assert.notEqual(normalizeName('Ducky Bhai'), normalizeName('Ducky Bro'));
});
