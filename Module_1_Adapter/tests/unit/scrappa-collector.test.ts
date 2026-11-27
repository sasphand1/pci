import test from 'node:test';
import assert from 'node:assert/strict';
import {parseProfile,parsePosts,summarize,collect} from '../../src/modules/scrappa/collector.ts';
const profile={code:0,data:{user:{id:'107955',uniqueId:'tiktok',privateAccount:false},stats:{followerCount:97208414,heartCount:469665065,videoCount:1511}}};
const posts={code:0,data:{videos:Array.from({length:10},(_,i)=>({video_id:String(100+i),author:{id:'107955'},create_time:1700000000-i,is_ad:false,is_top:0,duration:10,play_count:100+i,digg_count:10,comment_count:2,share_count:1}))}};
test('profile counts and nulls',()=>{const p=parseProfile(profile,'@tiktok');assert.equal(p.followers,97208414);assert.equal(p.following,null);});
test('profile mismatch',()=>assert.throws(()=>parseProfile(profile,'other'),/unverified/));
test('post ownership',()=>assert.throws(()=>parsePosts(posts,'999'),/mismatch/));
test('averages',()=>assert.equal(summarize(parsePosts(posts,'107955')).averageViews,104.5));
test('duplicates and incomplete cohort',()=>{const p=structuredClone(posts);p.data.videos[1]=p.data.videos[0];assert.equal(summarize(parsePosts(p,'107955')).averageViews,null);});
test('missing metric is not zero',()=>{const p=structuredClone(posts);delete p.data.videos[0].play_count;assert.equal(summarize(parsePosts(p,'107955')).averageViews,null);});
test('two calls, server key and stable id',async()=>{let credits=0;const urls=[];const r=await collect('tiktok','test',async()=>++credits<=2,async(u,o)=>{urls.push(String(u));assert.equal(o.headers['x-api-key'],'test');return Response.json(urls.length===1?profile:posts);});assert.equal(credits,2);assert.match(urls[1],/user_id=107955/);assert.equal(r.analytics.averageViews,104.5);});
test('quota refuses before network',async()=>{await assert.rejects(collect('tiktok','test',async()=>false,async()=>{throw Error('unexpected');}),/quota_exhausted/);});
test('no retries on 404',async()=>{let calls=0;await assert.rejects(collect('tiktok','test',async()=>true,async()=>{calls++;return new Response(null,{status:404});}),/http_404/);assert.equal(calls,1);});

test('bounded continuation fills excluded and duplicate posts',async()=>{
 const first=structuredClone(posts);first.data.videos[0].is_top=1;
 const next=structuredClone(posts);next.data.videos=next.data.videos.slice(0,2);next.data.videos[0].video_id='999';next.data.videos[0].create_time-=100;
 const cursors:string[]=[];let credits=0;
 const r=await collect('tiktok','test',async()=>{credits++;return true;},async u=>{
  const url=new URL(String(u));if(url.pathname.endsWith('/profile'))return Response.json(profile);
  const cursor=url.searchParams.get('cursor')!;cursors.push(cursor);
  return Response.json(cursor==='0'?{...first,data:{...first.data,hasMore:true,cursor:'20'}}:next);
 });
 assert.equal(credits,3);assert.deepEqual(cursors,['0','20']);assert.equal(r.posts.length,10);assert.equal(new Set(r.posts.map(p=>p.postId)).size,10);assert.notEqual(r.analytics.averageViews,null);
});
test('pagination is bounded to 4 credits including profile',async()=>{
 let calls=0;
 const r=await collect('tiktok','test',async()=>true,async u=>{
  calls++;if(String(u).includes('/profile'))return Response.json(profile);
  return Response.json({code:0,data:{videos:[posts.data.videos[0]],has_more:1,cursor:String(calls)}});
 });
 assert.equal(calls,4);assert.equal(r.analytics.sampleSize,1);assert.equal(r.analytics.averageViews,null);
});
test('repeated or unverified cursor stops rather than spending credits',async()=>{
 for(const cursor of ['0','https://other.invalid','']){
  let calls=0;const r=await collect('tiktok','test',async()=>true,async u=>{
   calls++;if(String(u).includes('/profile'))return Response.json(profile);
   return Response.json({code:0,data:{videos:[],hasMore:true,cursor}});
  });assert.equal(calls,2);assert.equal(r.analytics.sampleSize,0);
 }
});
test('quota exhausted mid-cohort fails without further request',async()=>{
 let calls=0,credits=0;
 await assert.rejects(collect('tiktok','test',async()=>++credits<=2,async u=>{calls++;return Response.json(String(u).includes('/profile')?profile:{code:0,data:{videos:[],hasMore:true,cursor:'20'}});}),/quota_exhausted/);
 assert.equal(calls,2);
});
test('identity mismatch on continuation invalidates full collection',async()=>{
 let calls=0;
 await assert.rejects(collect('tiktok','test',async()=>true,async()=>{calls++;return Response.json(calls===1?profile:calls===2?{code:0,data:{videos:[],hasMore:true,cursor:'20'}}:{code:0,data:{videos:[{...posts.data.videos[0],author:{id:'999'}}]}});}),/post_author_mismatch/);
});

test('changed staged identity stops before the posts request',async()=>{
 let calls=0;await assert.rejects(collect('tiktok','test',async()=>true,async()=>{calls++;return Response.json(profile);},'999'),/candidate_identity_changed/);assert.equal(calls,1);
});
