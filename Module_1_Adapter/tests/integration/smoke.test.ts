import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { makeApp } from '../../src/server.js';
import { pool,query } from '../../src/lib/db.js';
import { redis,ensureRedis } from '../../src/lib/redis.js';

// Run against an isolated development/test database with NODE_ENV=test,
// DEV_BYPASS_TURNSTILE=true. Never run writable tests on production.
// Fail closed against accidental integration tests on valuable data.
if(process.env.NODE_ENV!=='test' || !/\/[^/]*_test(?:\?|$)/.test(process.env.DATABASE_URL??'')){
 throw new Error('Refusing writable integration tests: set NODE_ENV=test and use a separate *_test PostgreSQL database');
}
const app=makeApp();
test('database and Redis are reachable',async()=>{
  assert.equal((await pool.query('SELECT 1 AS answer')).rows[0].answer,1);
  await ensureRedis();assert.equal(await redis.ping(),'PONG');
});
test('public metadata, editorial categories and health endpoints work',async()=>{
  const meta=await request(app).get('/api/v1/meta').expect(200);
  assert.equal(meta.body.data.advancedAnalytics,false);
  const categories=await request(app).get('/api/v1/categories').expect(200);
  assert.ok(categories.body.data.length>=7);
  const overview=await request(app).get('/api/v1/overview').expect(200);
  assert.equal(typeof overview.body.data.sumChannelViews,'string');
  await request(app).get('/health/ready').expect(200);
});
test('default public ranking and validation',async()=>{
  const listing=await request(app).get('/api/v1/creators').expect(200);
  assert.ok(Array.isArray(listing.body.data));
  await request(app).get('/api/v1/rankings?sort=malicious').expect(400);
  await request(app).get('/api/v1/creators?limit=100000').expect(400);
});
test('admin routes deny anonymous users and reject cross-origin writes',async()=>{
  await request(app).get('/api/v1/admin/dashboard').expect(401);
  await request(app).post('/api/v1/admin/sync-runs').send({}).expect(401);
  await request(app).post('/api/v1/wall/auth/guest').set('Origin','https://untrusted.invalid').send({nickname:'testing'}).expect(403);
});
test('guest can post to the single wall with an anti-bot development bypass',async(t)=>{
  if(process.env.DEV_BYPASS_TURNSTILE!=='true'){t.skip('Requires dev-only Turnstile bypass');return;}
  const nick=`test_${randomUUID().slice(0,8)}`;
  const identity=await request(app).post('/api/v1/wall/auth/guest').send({nickname:nick}).expect(201);
  const token=identity.body.data.token as string;
  const posted=await request(app).post('/api/v1/wall/messages').set('Authorization',`Bearer ${token}`).send({body:'Integration check message'}).expect(201);
  const id=posted.body.data.id as string;
  try {
    const messages=await request(app).get('/api/v1/wall/messages').expect(200);
    assert.ok(messages.body.data.some((m:any)=>m.id===id));
    await request(app).post('/api/v1/wall/messages').set('Authorization',`Bearer ${token}`).send({body:'Integration check message'}).expect(429);
  } finally {
    await query('DELETE FROM wall_messages WHERE id=$1',[id]);
  }
});
test.after(async()=>{await Promise.allSettled([pool.end(),redis.quit()]);});
