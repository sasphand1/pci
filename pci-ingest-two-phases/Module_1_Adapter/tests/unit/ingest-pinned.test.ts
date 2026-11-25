import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseCreatorPinnedComment} from '../../src/modules/ingest/pinned.ts';
const sample={contents:[
 {renderingPriority:'RENDERING_PRIORITY_PINNED_COMMENT',commentViewModel:{commentViewModel:{commentKey:'key-1',commentId:'abc'}}},
 {key:'key-1',commentEntityPayload:{commentId:'abc',properties:{content:{content:'Pinned note!'}},
  author:{isCreator:true,displayName:'Creator',channelId:'UCaaaaaaaaaaaaaaaaaaaaaa'},toolbar:{likeCount:'273',replyCount:'20'}}}
]};
test('extracts a verified creator-authored pinned comment',()=>{
 assert.deepEqual(parseCreatorPinnedComment(sample),{commentId:'abc',text:'Pinned note!',authorName:'Creator',
  authorChannelId:'UCaaaaaaaaaaaaaaaaaaaaaa',likes:273,replies:20,isPinned:true,isCreator:true});
});
test('never substitutes ordinary popular comments',()=>{
 const notPinned={contents:sample.contents.filter((x:any)=>!x.renderingPriority)};
 assert.equal(parseCreatorPinnedComment(notPinned),null);
});
test('rejects pinned comments not authored by creator',()=>{
 const wrong=structuredClone(sample);(wrong.contents[1] as any).commentEntityPayload.author.isCreator=false;
 assert.equal(parseCreatorPinnedComment(wrong),null);
});
test('rejects pinned entity missing correct key',()=>{
 const wrong=structuredClone(sample);(wrong.contents[1] as any).key='different';
 assert.equal(parseCreatorPinnedComment(wrong),null);
});

test('supports entity matching by pinned comment ID when no key is present',()=>{
 const value=structuredClone(sample);delete (value.contents[0] as any).commentViewModel.commentViewModel.commentKey;
 assert.equal(parseCreatorPinnedComment(value)?.commentId,'abc');
});
