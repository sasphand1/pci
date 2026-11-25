import assert from 'node:assert/strict';
import {test} from 'node:test';
// This test uses a standalone extractor rather than initiating an external Instagram request.
import {boundedResponseText,metaProperty,parseInstagramPublicAvatar} from '../../src/modules/ingest/http.ts';
const good=`<html><meta content="https://www.instagram.com/sample.creator/" property="og:url" />
<meta property="og:image" content="https://scontent.cdninstagram.com/path.jpg?x=1&amp;y=2"></html>`;
test('parses Instagram avatar only when canonical identity matches',()=>{
 assert.match(parseInstagramPublicAvatar(good,'sample.creator')??'',/cdninstagram\.com/);
 assert.equal(parseInstagramPublicAvatar(good,'unrelated'),null);
});
test('blocks unrelated/untrusted image hosts',()=>{
 assert.equal(parseInstagramPublicAvatar(good.replace('scontent.cdninstagram.com','localhost'),'sample.creator'),null);
 assert.equal(metaProperty('<meta property="og:title" content="test">','og:title'),'test');
});

test('bounded HTTP reader rejects oversized responses',async()=>{
 assert.equal(await boundedResponseText(new Response('0123456789'),5),null);
 assert.equal(await boundedResponseText(new Response('hello'),5),'hello');
});
