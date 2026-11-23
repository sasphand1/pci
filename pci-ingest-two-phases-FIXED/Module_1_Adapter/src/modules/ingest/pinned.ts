/** Parse a YouTube comment entity response already obtained from a legitimate source.
 * This parser does NOT fetch internal endpoints or guess missing comments. */
export type PinnedComment={commentId:string;text:string;authorName:string;authorChannelId:string;likes:number|null;replies:number|null;isPinned:true;isCreator:true};
const safeCount=(v:unknown):number|null=>{
  if(typeof v==='number' && Number.isSafeInteger(v) && v>=0)return v;
  if(typeof v==='string' && /^\d{1,15}$/.test(v))return Number(v);
  return null;
};
function walk(node:unknown, visit:(x:Record<string,unknown>)=>void, depth=0):void {
  if(depth>36 || !node || typeof node!=='object')return;
  if(Array.isArray(node)){for(const x of node)walk(x,visit,depth+1);return;}
  const o=node as Record<string,unknown>;
  visit(o);
  for(const v of Object.values(o))walk(v,visit,depth+1);
}
function obj(v:unknown):Record<string,any>{return v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,any>:{};}
export function parseCreatorPinnedComment(response:unknown):PinnedComment|null {
  const entities=new Map<string,Record<string,any>>();
  let pinnedKey:string|null=null,pinnedId:string|null=null;
  walk(response,outer=>{
    const payload=obj(outer.commentEntityPayload);
    const key=typeof outer.key==='string'?outer.key:typeof outer.commentKey==='string'?outer.commentKey:null;
    if(key&&Object.keys(payload).length)entities.set(key,payload);
    if(outer.renderingPriority==='RENDERING_PRIORITY_PINNED_COMMENT'){
      const model=obj(obj(outer.commentViewModel).commentViewModel);
      const direct=obj(outer.commentViewModel);
      pinnedKey=typeof model.commentKey==='string'?model.commentKey:typeof direct.commentKey==='string'?direct.commentKey:typeof outer.commentKey==='string'?outer.commentKey:null;
      pinnedId=typeof model.commentId==='string'?model.commentId:typeof direct.commentId==='string'?direct.commentId:null;
    }
  });
  if(!pinnedKey && !pinnedId)return null;
  const payload=pinnedKey?entities.get(pinnedKey):
    (pinnedId?[...entities.values()].find(e=>e.commentId===pinnedId):undefined);
  if(!payload)return null; // Never fall back to a popular or unrelated comment.
  const author=obj(payload.author);
  if(author.isCreator!==true)return null;
  const id=typeof payload.commentId==='string'?payload.commentId:pinnedId;
  const text=payload.properties?.content?.content ?? payload.content?.content ?? payload.content;
  const name=author.displayName ?? author.name;
  const channelId=author.channelId ?? author.channel_id;
  if(!id||typeof text!=='string'||!text.trim()||typeof name!=='string'||!name||typeof channelId!=='string'||!channelId)return null;
  const toolbar=obj(payload.toolbar);
  return {commentId:id,text:text.slice(0,4000),authorName:name.slice(0,200),authorChannelId:channelId,
    likes:safeCount(toolbar.likeCount ?? payload.likeCount),replies:safeCount(payload.replyCount ?? toolbar.replyCount),isPinned:true,isCreator:true};
}
