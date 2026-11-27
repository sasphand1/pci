import { z } from 'zod';
import { query, transaction } from '../../lib/db.js';
import { encryptSecret, decryptSecret, sha256 } from '../../lib/security.js';
import { handler, HttpError } from '../../lib/errors.js';
import { roles, type AdminIdentity } from '../auth/auth.js';
import type { Router } from 'express';
import { collectProfile, username } from './collector.js';
const SQL = `CREATE TABLE IF NOT EXISTS scrappa_admin_keys (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), label text NOT NULL, fingerprint text NOT NULL UNIQUE, ciphertext text NOT NULL, active boolean NOT NULL DEFAULT false);
CREATE UNIQUE INDEX IF NOT EXISTS scrappa_one_active_key ON scrappa_admin_keys(active) WHERE active;
CREATE TABLE IF NOT EXISTS scrappa_credit_month (month date PRIMARY KEY, used integer NOT NULL CHECK(used BETWEEN 0 AND 500));
CREATE TABLE IF NOT EXISTS scrappa_candidates (external_id text PRIMARY KEY, handle text NOT NULL UNIQUE, display_name text, person_name text, niche text, checked_at timestamptz NOT NULL DEFAULT now());`;
let ready: Promise<unknown>|undefined;
function ensure(){return ready??=(query(SQL).catch(e=>{ready=undefined;throw e;}));}
const month = "date_trunc('month',now() AT TIME ZONE 'UTC')::date";
async function reserve(){const r=await query(`INSERT INTO scrappa_credit_month(month,used) VALUES(${month},1) ON CONFLICT(month) DO UPDATE SET used=scrappa_credit_month.used+1 WHERE scrappa_credit_month.used<500 RETURNING used`);return Boolean(r.rowCount);}
async function keys(){return (await query('SELECT id,label,active FROM scrappa_admin_keys ORDER BY label,id')).rows;}
function handle(raw:string){let v=raw.trim();if(v.includes('/')){const u=new URL(v.startsWith('https://')?v:'https://'+v);if(!['tiktok.com','www.tiktok.com','m.tiktok.com'].includes(u.hostname)||u.username||u.password||u.port||!/^\/@[^/]+\/?$/.test(u.pathname))throw Error('invalid_username');v=u.pathname.split('/')[1];}return username(v);}
async function lookup(raw:string){let name:string;try{name=handle(raw);}catch{throw new HttpError(400,'INVALID_HANDLE','Enter a TikTok username or profile URL');}const key=(await query<{ciphertext:string}>('SELECT ciphertext FROM scrappa_admin_keys WHERE active')).rows[0];if(!key)throw new HttpError(409,'SCRAPPA_KEY_MISSING','Owner must activate a Scrappa key');try{return await collectProfile(name,decryptSecret(key.ciphertext),reserve);}catch(e){const msg=e instanceof Error?e.message:'';throw new HttpError(msg==='quota_exhausted'?429:422,'SCRAPPA_LOOKUP',msg==='quota_exhausted'?'Monthly PCI credit limit reached':'Profile lookup failed or account is not public');}}
export function mountScrappaAdmin(router:Router){
 router.get('/bucket/scrappa/keys',roles('owner'),handler(async(_req,res)=>{await ensure();res.json({data:{keys:await keys(),used:Number((await query(`SELECT used FROM scrappa_credit_month WHERE month=${month}`)).rows[0]?.used??0),limit:500}});}));
 router.post('/bucket/scrappa/keys',roles('owner'),handler(async(req,res)=>{await ensure();const b=z.object({label:z.string().trim().min(1).max(80),apiKey:z.string().trim().min(8).max(512)}).strict().parse(req.body);await transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(710329)');await c.query('INSERT INTO scrappa_admin_keys(label,fingerprint,ciphertext) VALUES($1,$2,$3) ON CONFLICT(fingerprint) DO NOTHING',[b.label,sha256(b.apiKey),encryptSecret(b.apiKey)]);await c.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[(res.locals.admin as AdminIdentity).id,'scrappa.key.save','scrappa','{}']);});res.json({data:await keys()});}));
 router.post('/bucket/scrappa/keys/:id/activate',roles('owner'),handler(async(req,res)=>{await ensure();const id=z.string().uuid().parse(req.params.id);await transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(710329)');if(!(await c.query('SELECT 1 FROM scrappa_admin_keys WHERE id=$1',[id])).rowCount)throw new HttpError(404,'NOT_FOUND','Key not found');await c.query('UPDATE scrappa_admin_keys SET active=false WHERE active');await c.query('UPDATE scrappa_admin_keys SET active=true WHERE id=$1',[id]);});res.json({data:await keys()});}));
 router.get('/bucket/scrappa/candidates',roles('owner','editor'),handler(async(_req,res)=>{await ensure();res.json({data:(await query('SELECT external_id,handle,display_name,person_name,niche,checked_at FROM scrappa_candidates ORDER BY checked_at DESC LIMIT 200')).rows});}));
 router.post('/bucket/scrappa/check',roles('owner','editor'),handler(async(req,res)=>{await ensure();const b=z.object({account:z.string().min(1).max(200)}).strict().parse(req.body);res.json({data:await lookup(b.account)});}));
 router.post('/bucket/scrappa/candidates',roles('owner','editor'),handler(async(req,res)=>{await ensure();const b=z.object({account:z.string().min(1).max(200),person:z.string().max(120).optional(),niche:z.string().max(60).optional()}).strict().parse(req.body);const p=await lookup(b.account);await query('INSERT INTO scrappa_candidates(external_id,handle,display_name,person_name,niche) VALUES($1,$2,$3,$4,$5) ON CONFLICT(external_id) DO UPDATE SET handle=excluded.handle,display_name=excluded.display_name,person_name=excluded.person_name,niche=excluded.niche,checked_at=now()',[p.accountId,p.handle,p.name,b.person||null,b.niche||null]);res.json({data:{handle:p.handle}});}));
}
