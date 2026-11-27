import test from 'node:test';
import assert from 'node:assert/strict';
import {projectTikTok,rankTikTok,metricOf} from '../../src/modules/public/tiktok-rules.js';
const now=Date.parse('2026-11-28T00:00:00Z');
const fixture={external_id:'123',handle:'creator',published_at:'2026-11-27',observed_at:'2026-11-27',profile:{accountId:'123',handle:'creator',followers:100,likes:20},analytics:{sampleSize:10,averageViews:50}};
test('private, changed identity and invalid counts cannot publish',()=>{for(const x of [{...fixture,published_at:null},{...fixture,handle:'changed'},{...fixture,profile:{...fixture.profile,followers:-1}}])assert.equal(projectTikTok(x,now),null);});
test('cohort must contain ten; null is not zero',()=>{const r=projectTikTok({...fixture,analytics:{sampleSize:9,averageViews:100}},now)!;assert.equal(r.averageViews,null);assert.equal(r.posts,null);});
test('stale values unranked; ties use competition ranks',()=>{const r=projectTikTok(fixture,now)!;const rows=rankTikTok([r,{...r,handle:'abc'},{...r,handle:'other',followers:20},{...r,handle:'old',stale:true,followers:1000}],metricOf('followers'));assert.deepEqual(rows.map(x=>x.rank),[1,1,3,null]);});
test('ranking does not disclose private provider payloads',()=>{const r=projectTikTok({...fixture,profile:{...fixture.profile,bio:'private',avatar:'https://example.com'}},now)!;assert.equal('bio' in r,false);assert.equal('profile' in r,false);assert.equal('external_id' in r,false);});
