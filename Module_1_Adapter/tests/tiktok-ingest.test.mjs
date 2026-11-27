import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../src/modules/tiktok/core.mjs';
const NOW=Date.parse('2026-11-27T12:00:00Z');

test('TikTok input: usernames and profile links only, lower-case, never a URL fetch',()=>{
  for(const s of ['@Some.User_1','some.user_1','https://www.tiktok.com/@some.user_1','tiktok.com/@Some.User_1/video/123','m.tiktok.com/@some.user_1'])
    assert.deepEqual(core.parseTikTokInput(s),{ok:true,kind:'username',value:'some.user_1'},s);
  for(const s of ['','a','https://vm.tiktok.com/ZM123/','https://evil.com/@x','https://www.tiktok.com/tag/x','x'.repeat(25),'bad name'])
    assert.equal(core.parseTikTokInput(s).ok,false,s);
});

test('OAuth authorize URL follows Login Kit for Web (no PKCE), state is strong and hashed',()=>{
  const state=core.newState();
  assert.ok(state.length>=43);
  const u=new URL(core.buildAuthorizeUrl({clientKey:'abc123def',redirectUri:'https://primal-ivory-mouse-02.hostingersite.com/tiktok/callback',state}));
  assert.equal(u.origin+u.pathname,'https://www.tiktok.com/v2/auth/authorize/');
  assert.equal(u.searchParams.get('response_type'),'code');
  assert.equal(u.searchParams.get('scope'),'user.info.basic,user.info.profile,user.info.stats,video.list');
  assert.equal(u.searchParams.get('code_challenge'),null);
  assert.match(core.hashState(state),/^[0-9a-f]{64}$/);
  assert.throws(()=>core.buildAuthorizeUrl({clientKey:'abc123def',redirectUri:'https://x.com/cb?y=1',state}),/REDIRECT/);
  assert.throws(()=>core.buildAuthorizeUrl({clientKey:'abc123def',redirectUri:'http://x.com/cb',state}),/REDIRECT/);
  assert.throws(()=>core.buildAuthorizeUrl({clientKey:'abc123def',redirectUri:'https://x.com/cb',state:'short'}),/STATE/);
});

test('OAuth state is single use, expires and is bound to the admin',()=>{
  const row={admin_id:'a',expires_at:new Date(NOW+60_000).toISOString(),used_at:null};
  assert.equal(core.stateDecision(row,{now:NOW,adminId:'a'}),'ok');
  assert.equal(core.stateDecision({...row,used_at:'x'},{now:NOW,adminId:'a'}),'used');
  assert.equal(core.stateDecision({...row,expires_at:new Date(NOW-1).toISOString()},{now:NOW,adminId:'a'}),'expired');
  assert.equal(core.stateDecision(row,{now:NOW,adminId:'b'}),'wrong_admin');
  assert.equal(core.stateDecision(null,{now:NOW,adminId:'a'}),'unknown');
});

test('token response: expiry computed, errors carry no token material, refresh margin',()=>{
  const t=core.parseTokenResponse({access_token:'act.x',refresh_token:'rft.y',open_id:'oid-1',scope:'user.info.basic,video.list',expires_in:7200,refresh_expires_in:15552000,token_type:'Bearer'},NOW);
  assert.equal(t.ok,true);
  assert.equal(t.accessExpiresAt,new Date(NOW+7200_000).toISOString());
  assert.deepEqual(t.scopes,['user.info.basic','video.list']);
  assert.deepEqual(core.missingScopes(t.scopes),['user.info.profile','user.info.stats']);
  const e=core.parseTokenResponse({error:'invalid_grant',error_description:'Token endpoint rejected the request',log_id:'z'},NOW);
  assert.deepEqual(e,{ok:false,error:'invalid_grant',description:'Token endpoint rejected the request'});
  assert.equal(core.parseTokenResponse({access_token:'a'},NOW).ok,false);
  assert.equal(core.accessNeedsRefresh(new Date(NOW+300_000).toISOString(),NOW),true);
  assert.equal(core.accessNeedsRefresh(new Date(NOW+3_600_000).toISOString(),NOW),false);
  assert.equal(core.refreshUsable(new Date(NOW-1).toISOString(),NOW),false);
});

test('user info: exact counts, missing stays missing, open_id attribution enforced',()=>{
  const body={data:{user:{open_id:'oid-1',username:'Abc',display_name:'A',follower_count:1500,following_count:'20',likes_count:9,video_count:null}},error:{code:'ok',message:''}};
  const r=core.mapUserInfo(body,200,'oid-1');
  assert.equal(r.outcome,'ok');
  assert.deepEqual(r.metrics,[{metric:'followers',value:1500,accuracy:'exact'}]);
  assert.deepEqual(r.extra.map(x=>x.metric),['following','likes_total']);
  assert.match(r.detail,/video_count_unavailable/);
  assert.equal(r.identity.username,'abc');
  assert.equal(core.mapUserInfo(body,200,'oid-2').detail,'open_id_mismatch');
  assert.equal(core.mapUserInfo({data:{user:{open_id:'oid-1',display_name:'A'}},error:{code:'ok'}},200).outcome,'unsupported');
  assert.equal(core.mapUserInfo({error:{code:'access_token_invalid'}},401).detail,'access_token_invalid');
  assert.equal(core.mapUserInfo({error:{code:'rate_limit_exceeded'}},429).outcome,'rate_limited');
  assert.equal(core.toCount(2**53),null,'never rounded');
  assert.equal(core.toCount(-1),null);
});

test('videos: nulls never become zero; posts_30d and sample stats are deterministic',()=>{
  const s=Math.floor(NOW/1000),day=86400;
  const page=core.mapVideoPage({data:{videos:[
    {id:'7300000000000000001',create_time:s-day,view_count:1000,like_count:100,comment_count:10,share_count:5,width:1080,height:1920,duration:15},
    {id:'7300000000000000002',create_time:s-2*day,view_count:500},
    {id:'bad'},
    {id:'7300000000000000003',create_time:s-45*day,view_count:100,like_count:1,comment_count:0,share_count:0}],cursor:123,has_more:true},error:{code:'ok'}},200);
  assert.equal(page.ok,true);assert.equal(page.videos.length,3);assert.equal(page.dropped,1);assert.equal(page.hasMore,true);
  assert.equal(page.videos[1].counts.likes,null);
  assert.equal(page.videos[0].aspectRatio,0.563);
  assert.deepEqual(core.postsLast30(page.videos,NOW,false),{value:2,capped:false});
  assert.deepEqual(core.postsLast30(page.videos.slice(0,2),NOW,false),{value:2,capped:true});
  const st=core.videoStats(page.videos,10000);
  assert.equal(st.sampled,3);assert.equal(st.medianViews,500);assert.equal(st.bestVideoId,'7300000000000000001');
  assert.equal(st.engagementRateByViewsPct,6.25);
  assert.match(st.sampleNote,/not lifetime/);
});


test('malformed URL, timestamp, token lifetime and video pagination fail safely',()=>{
 assert.equal(core.parseTikTokInput('https://www.tiktok.com/@%ZZ').ok,false);
 assert.equal(core.mapVideo({id:'12345',create_time:Number.MAX_SAFE_INTEGER}).publishedAt,null);
 assert.equal(core.parseTokenResponse({access_token:'a',refresh_token:'r',open_id:'id',expires_in:Infinity,refresh_expires_in:7200},NOW).ok,false);
 assert.equal(core.mapVideoPage({data:{videos:[],has_more:true}},200).ok,false);
 assert.equal(core.mapVideoPage({data:{}},200).ok,false);
});
test('duplicate videos cannot inflate activity; future timestamps excluded',()=>{
 const video={id:'12345',publishedAt:new Date(NOW-1000).toISOString()};
 assert.deepEqual(core.postsLast30([video,video,{id:'12346',publishedAt:new Date(NOW+1000).toISOString()}],NOW,true),{value:1,capped:false});
});
