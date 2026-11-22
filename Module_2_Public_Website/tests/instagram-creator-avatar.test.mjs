import test from 'node:test';
import assert from 'node:assert/strict';
import {safeCreatorImage,safeYoutubeImage} from '../src/lib/format.mjs';

test('allow legitimate instagram and facebook CDN profile pictures',()=>{
 for(const url of ['https://scontent.cdninstagram.com/pic.jpg?x=1','https://scontent.xx.fbcdn.net/v/t51.2885-19/a.jpg','https://yt3.ggpht.com/abc'])
   assert.equal(safeCreatorImage(url),url);
});
test('reject insecure, disguised, credentialed, and arbitrary picture URLs',()=>{
 for(const url of ['http://scontent.cdninstagram.com/a.jpg','https://fbcdn.net.evil.com/x','https://cdninstagram.com.evil.com/a','https://attacker.com/a.jpg','https://user:pass@scontent.xx.fbcdn.net/a.jpg','javascript:alert(1)',null])
   assert.equal(safeCreatorImage(url),null);
});
test('video image policy remains YouTube only',()=>{
 assert.equal(safeYoutubeImage('https://scontent.xx.fbcdn.net/a.jpg'),null);
 assert.equal(safeYoutubeImage('https://yt3.ggpht.com/a.jpg'),'https://yt3.ggpht.com/a.jpg');
});
