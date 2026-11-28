import test from 'node:test';
import assert from 'node:assert/strict';
import {formatCount,safeYoutubeImage,safeVideoId,safeChannelId,displayDate,isStale,displayTime} from '../src/lib/format.mjs';
test('decimal strings preserve precision above Number.MAX_SAFE_INTEGER',()=>{
 assert.equal(formatCount('9007199254740993'),'9,007,199,254,740,993');
 assert.equal(formatCount('0'),'0');assert.equal(formatCount(null),'Unavailable');assert.equal(formatCount('oops'),'Unavailable');
});
test('compact values display rounded magnitudes',()=>{
 assert.equal(formatCount('2450000',true),'2.5M');assert.equal(formatCount('12500',true),'12.5K');assert.equal(formatCount('999',true),'999');assert.equal(formatCount('999950',true),'1M');
});
test('untrusted image sources are blocked',()=>{
 assert.equal(safeYoutubeImage('https://i.ytimg.com/vi/abc/default.jpg'),'https://i.ytimg.com/vi/abc/default.jpg');
 assert.equal(safeYoutubeImage('https://i.ytimg.com.evil.com/pic'),null);
 assert.equal(safeYoutubeImage('javascript:alert(1)'),null);
 assert.equal(safeYoutubeImage('http://i.ytimg.com/any'),null);
});
test('external source identifiers are validated',()=>{
 assert.equal(safeVideoId('abcdefghijk'),'abcdefghijk');assert.equal(safeVideoId('../bad'),null);
 assert.equal(safeChannelId('UC'+'a'.repeat(22)),'UC'+'a'.repeat(22));assert.equal(safeChannelId('bad'),null);
});
test('dates handle invalid/missing values and stale snapshots',()=>{
 assert.equal(displayDate(null),'Not available');assert.equal(displayDate('invalid'),'Not available');
 assert.equal(displayDate('2026-11-12T08:00:00Z'),'12 Nov 2026');assert.equal(displayTime('2026-11-12T08:00:00Z'),'13:00 PKT');assert.equal(isStale(null),true);
 assert.equal(isStale(new Date().toISOString()),false);
});

test('safeCreatorImage accepts the own-copy picture path and nothing else on unknown hosts',async()=>{
  const {safeCreatorImage}=await import('../src/lib/format.mjs');
  assert.ok(safeCreatorImage('https://api.example.com/api/v1/public/avatars/123e4567-e89b-12d3-a456-426614174000?v=1'));
  assert.equal(safeCreatorImage('https://api.example.com/other/123e4567-e89b-12d3-a456-426614174000'),null);
  assert.equal(safeCreatorImage('https://evil.example.com/a.jpg'),null);
});

test('TikTok avatar intake shares the established HTTPS image policy',async()=>{const {safeCreatorImage}=await import('../src/lib/format.mjs');assert.ok(safeCreatorImage('https://p16-sign-va.tiktokcdn.com/pic.jpg'));for(const url of ['https://p16.tiktokcdn.com.evil.example/pic','http://p16.tiktokcdn.com/pic','https://u:p@p16.tiktokcdn.com/pic','https://p16.tiktokcdn.com:8080/pic'])assert.equal(safeCreatorImage(url),null);});
