import test from 'node:test';
import assert from 'node:assert/strict';
import {chunks,countOrNull,dateOrNull,thumbUrl,roundedMean} from '../src/modules/youtube/normalizers.mjs';
test('YouTube batches exactly 50',()=>{
  assert.deepEqual(chunks(Array.from({length:101},(_,i)=>i),50).map(x=>x.length),[50,50,1]);
});
test('reject invalid chunk sizes',()=>assert.throws(()=>chunks([1],0)));
test('count normalization avoids IEEE-754 precision loss',()=>{
 assert.equal(countOrNull('9007199254740993'),'9007199254740993');
 assert.equal(countOrNull('0005'),'5');
 assert.equal(countOrNull(''),null);
});
test('counts are missing rather than fabricated if not returned',()=>{
 for(const x of [null,undefined,0,-1,'-1','3.4','not-a-number',''])assert.equal(countOrNull(x),null);
 assert.throws(()=>countOrNull('9223372036854775808'),/exceeds/);
});
test('date rejects malformed input and normalizes ISO',()=>{
 assert.equal(dateOrNull('bad'),null);
 assert.equal(dateOrNull('2026-01-12T09:00:00Z'),'2026-01-12T09:00:00.000Z');
});
test('only https thumbnails passed through',()=>{
 assert.equal(thumbUrl({thumbnails:{high:{url:'http://example.com/a.png'}}}),null);
 assert.equal(thumbUrl({thumbnails:{high:{url:'https://i.ytimg.com/vi/123/hqdefault.jpg'}}}),'https://i.ytimg.com/vi/123/hqdefault.jpg');
});
test('exact bigint mean with half-up rounding',()=>{
 assert.equal(roundedMean('9007199254740993',3),'3002399751580331');
 assert.equal(roundedMean(5n,2),'3');
 assert.equal(roundedMean(0n,0),null);
});
