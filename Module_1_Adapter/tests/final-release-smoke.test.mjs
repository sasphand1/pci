import test from 'node:test';
import assert from 'node:assert/strict';
import {smoke} from '../scripts/final-release-smoke.mjs';
const api='https://api.example.test',website='https://www.example.test';
function fixture({missing=false,adminStatus=404}={}){return async u=>{
 const path=u.pathname;const ranking=scope=>({scope,publishedAt:'2026-11-28T20:00:00Z',entries:[{}]});
 if(path==='/admin')return new Response('',{status:adminStatus});
 if(path==='/health/live')return Response.json({status:'alive'});
 if(path==='/health/ready')return Response.json({status:'ready'});
 if(path.endsWith('/wheel'))return Response.json({data:{sorts:[ranking('wheel.subscribed'),ranking('wheel.viewed'),ranking('wheel.active')]}});
 if(path.endsWith('/rows'))return Response.json({data:{platforms:[ranking('youtube.subscribed'),ranking('instagram.followers')]}});
 if(path.endsWith('/status'))return Response.json({data:{scopes:[{scope:'tiktok.followers',publishedAt:'2026-11-28T20:00:00Z',covered:5}]}});
 if(path.endsWith('/tiktok'))return Response.json({pagination:{total:missing?4:5},data:Array.from({length:missing?4:5},(_,i)=>({rank:i+1,followers:100-i,stale:false}))});
 return new Response('',{status:404});};}
test('read-only smoke checks complete five-member cohort and no public admin',async()=>{const r=await smoke(api,{expectedTikTok:5,website,fetcher:fixture()});assert.equal(r.passed,true);assert.equal(r.checks.length,7);});
test('missing creator and public admin redirect are blocking',async()=>{const r=await smoke(api,{expectedTikTok:5,website,fetcher:fixture({missing:true,adminStatus:302})});assert.equal(r.passed,false);assert.equal(r.checks.filter(x=>x.status==='failed').length,2);});
test('credentialed or insecure API origin is refused',async()=>{await assert.rejects(smoke('http://api.example.test',{fetcher:fixture()}));await assert.rejects(smoke('https://secret:password@api.example.test',{fetcher:fixture()}));});
