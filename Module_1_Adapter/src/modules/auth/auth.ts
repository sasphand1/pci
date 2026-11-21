import { randomUUID } from 'node:crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { pool, query } from '../../lib/db.js';
import { redis, boundedLimit } from '../../lib/redis.js';
import { isBackgroundRequest, sessionInfo, sessionTtlSeconds } from './session.js';
import { config } from '../../lib/config.js';
import { handler,HttpError } from '../../lib/errors.js';
import { opaqueToken,sha256,hashPassword,verifyPassword,decryptSecret,validTotp,pseudonym } from '../../lib/security.js';
import { verifyTurnstile } from './turnstile.js';
import { sendVerificationMail,sendPasswordResetMail } from './mailer.js';

export const adminAuthRoutes=Router();
export const wallAuthRoutes=Router();
const email=z.string().trim().toLowerCase().email().max(254);
const password=z.string().min(12).max(128);
const nickname=z.string().trim().min(3).max(24).regex(/^[\p{L}\p{N}_.-]+$/u);
const tokenTTL=()=>config.WALL_SESSION_DAYS*86400;
export type WallIdentity={type:'guest'|'user',id:string,nickname:string,version?:number};
export type AdminIdentity={id:string,email:string,role:'owner'|'editor'|'moderator',csrf:string,version:number,exp?:number};
function ipHash(req:Request){return pseudonym(req.ip??'unknown');}
async function gate(req:Request,scope:string,max:number,windowSeconds:number) {
  if(!await boundedLimit(`ratelimit:${scope}:${ipHash(req)}`,max,windowSeconds))throw new HttpError(429,'RATE_LIMIT','Too many requests');
}
async function createWallSession(identity:WallIdentity){const token=opaqueToken();await redis.set(`wall:session:${sha256(token)}`,JSON.stringify(identity),'EX',tokenTTL());return token;}
export async function readWallIdentity(token:string):Promise<WallIdentity|null>{
 if(!token||token.length>200)return null;
 const raw=await redis.get(`wall:session:${sha256(token)}`);
 if(!raw)return null;
 const session=JSON.parse(raw) as WallIdentity;
 if(session.type==='user'){
   const r=await query('SELECT active,email_verified_at,session_version FROM wall_users WHERE id=$1',[session.id]);
   if(!r.rows[0]?.active || !r.rows[0]?.email_verified_at || session.version!==r.rows[0]?.session_version)return null;
 }
 return session;
}
export async function requireWall(req:Request,_res:Response,next:NextFunction){
 try{ const h=req.headers.authorization??'';
   if(!h.startsWith('Bearer '))throw new HttpError(401,'AUTH_REQUIRED','Wall session required');
   const user=await readWallIdentity(h.slice(7));if(!user)throw new HttpError(401,'AUTH_REQUIRED','Session invalid or expired');
   _res.locals.wallUser=user;next();
 } catch(e){next(e);}
}
export async function requireAdmin(req:Request,res:Response,next:NextFunction){
 try {const token=req.cookies?.pci_admin;
   if(typeof token!=='string') throw new HttpError(401,'ADMIN_AUTH_REQUIRED','Admin authentication required');
   const key=`admin:session:${sha256(token)}`;
   const raw=await redis.get(key);
   if(!raw)throw new HttpError(401,'ADMIN_AUTH_REQUIRED','Admin session expired');
   const identity=JSON.parse(raw) as AdminIdentity;
   // Idle timeout inside the absolute limit. Background polling never extends it.
   if(!isBackgroundRequest(req.header('x-pci-background'))){
     const ttl=sessionTtlSeconds(Math.floor(Date.now()/1000),identity.exp,config.ADMIN_IDLE_MINUTES*60);
     if(ttl<=0){await redis.del(key);throw new HttpError(401,'ADMIN_SESSION_EXPIRED','Your session ended. Sign in again.');}
     await redis.expire(key,ttl);
   }
   const active=await query('SELECT role,active,session_version FROM admin_users WHERE id=$1',[identity.id]);
   if(!active.rows[0]?.active || active.rows[0].session_version!==identity.version)throw new HttpError(401,'ADMIN_DISABLED','Account disabled or session revoked');
   identity.role=active.rows[0].role;
   if(!['GET','HEAD','OPTIONS'].includes(req.method)){
     if(req.header('x-csrf-token')!==identity.csrf)throw new HttpError(403,'CSRF','Invalid CSRF token');
   }
   res.locals.admin=identity;next();
 }catch(e){next(e);}
}
export function roles(...allowed:AdminIdentity['role'][]){return (_req:Request,res:Response,next:NextFunction)=>{
 const a=res.locals.admin as AdminIdentity;if(!a||!allowed.includes(a.role))return next(new HttpError(403,'FORBIDDEN','Insufficient role'));next();
};}
function adminCookie(res:Response,token:string){res.cookie('pci_admin',token,{httpOnly:true,secure:config.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:config.ADMIN_SESSION_HOURS*3600_000});}
export async function audit(actor:string|null,action:string,subject:string|null,metadata:object={}){
 await query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[actor,action,subject,JSON.stringify(metadata)]);
}
adminAuthRoutes.post('/login',handler(async(req,res)=>{
 await gate(req,'admin-login',8,900);
 const body=z.object({email,password:z.string().min(1).max(128),totp:z.string().regex(/^\d{6}$/)}).parse(req.body);
 const r=await query('SELECT * FROM admin_users WHERE email=$1',[body.email.toLowerCase()]);const user=r.rows[0];
 if(!user?.active || !await verifyPassword(user.password_hash,body.password) || !validTotp(decryptSecret(user.totp_secret_enc),body.totp)){
   throw new HttpError(401,'INVALID_CREDENTIALS','Invalid login credentials or MFA code');
 }
 const token=opaqueToken(),csrf=opaqueToken();
 const nowSec=Math.floor(Date.now()/1000);
 const identity:AdminIdentity={id:user.id,email:user.email,role:user.role,csrf,version:user.session_version,exp:nowSec+config.ADMIN_SESSION_HOURS*3600};
 await redis.set(`admin:session:${sha256(token)}`,JSON.stringify(identity),'EX',sessionTtlSeconds(nowSec,identity.exp,config.ADMIN_IDLE_MINUTES*60));
 adminCookie(res,token);
 await query('UPDATE admin_users SET last_login_at=now() WHERE id=$1',[user.id]);await audit(user.id,'admin.login',user.id);
 res.json({data:{id:user.id,email:user.email,role:user.role,csrfToken:csrf,session:sessionInfo(nowSec,identity.exp,config.ADMIN_IDLE_MINUTES*60)}});
}));
adminAuthRoutes.post('/logout',requireAdmin,handler(async(req,res)=>{
 await redis.del(`admin:session:${sha256(req.cookies.pci_admin)}`);res.clearCookie('pci_admin',{path:'/',sameSite:'strict',secure:config.NODE_ENV==='production'});await audit(res.locals.admin.id,'admin.logout',res.locals.admin.id);res.json({data:{ok:true}});
}));
adminAuthRoutes.get('/me',requireAdmin,handler(async(_req,res)=>{
 const a=res.locals.admin as AdminIdentity;res.json({data:{id:a.id,email:a.email,role:a.role,csrfToken:a.csrf,session:sessionInfo(Math.floor(Date.now()/1000),a.exp,config.ADMIN_IDLE_MINUTES*60)}});
}));

wallAuthRoutes.post('/guest',handler(async(req,res)=>{
 await gate(req,'guest',12,3600);
 const b=z.object({nickname,turnstileToken:z.string().optional()}).parse(req.body);
 await verifyTurnstile(b.turnstileToken,req.ip);
 const reserved=['admin','administrator','owner','moderator','support','official','system','youtube'];
 if(reserved.includes(b.nickname.toLowerCase()))throw new HttpError(400,'RESERVED_NICKNAME','Nickname unavailable');
 const collision=await query('SELECT 1 FROM wall_users WHERE lower(nickname)=lower($1)',[b.nickname]);
 if(collision.rowCount)throw new HttpError(409,'NICKNAME_RESERVED','Nickname belongs to a registered user');
 const identity:WallIdentity={type:'guest',id:randomUUID(),nickname:b.nickname};
 const token=await createWallSession(identity);
 res.status(201).json({data:{identity,token,expiresIn:tokenTTL()}});
}));
wallAuthRoutes.post('/register',handler(async(req,res)=>{
 await gate(req,'register',6,3600);
 const b=z.object({email,password,nickname,turnstileToken:z.string().optional()}).parse(req.body);
 await verifyTurnstile(b.turnstileToken,req.ip);
 if(['admin','administrator','owner','moderator','support','official','system','youtube'].includes(b.nickname.toLowerCase()))throw new HttpError(400,'RESERVED_NICKNAME','Nickname unavailable');
 const hash=await hashPassword(b.password);
 let userId:string;
 try{const r=await query('INSERT INTO wall_users(email,nickname,password_hash) VALUES($1,$2,$3) RETURNING id',[b.email,b.nickname,hash]);userId=r.rows[0].id;}
 catch(e:any){if(e.code==='23505')throw new HttpError(409,'ACCOUNT_EXISTS','Email or nickname is unavailable');throw e;}
 await issueVerification(userId,b.email);
 res.status(201).json({data:{message:'Account created. Check email to verify before login.'}});
}));
async function issueVerification(userId:string,address:string){
 const token=opaqueToken(),hash=sha256(token);
 await query("DELETE FROM email_verifications WHERE user_id=$1",[userId]);
 await query("INSERT INTO email_verifications(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '24 hours')",[hash,userId]);
 await sendVerificationMail(address,token);
}
wallAuthRoutes.post('/resend-verification',handler(async(req,res)=>{
 await gate(req,'resend',4,3600);
 const b=z.object({email,turnstileToken:z.string().optional()}).parse(req.body);await verifyTurnstile(b.turnstileToken,req.ip);
 const r=await query('SELECT id FROM wall_users WHERE email=$1 AND email_verified_at IS NULL AND active=true',[b.email]);
 if(r.rows[0])await issueVerification(r.rows[0].id,b.email);
 res.json({data:{message:'If eligible, a verification email has been sent.'}});
}));
wallAuthRoutes.post('/verify-email',handler(async(req,res)=>{
 await gate(req,'verify',12,3600);
 const b=z.object({token:z.string().min(20).max(256)}).parse(req.body);
 const result=await pool.connect();
 try{await result.query('BEGIN');const r=await result.query('SELECT * FROM email_verifications WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE',[sha256(b.token)]);
   if(!r.rows[0])throw new HttpError(400,'TOKEN_INVALID','Verification token invalid or expired');
   await result.query('UPDATE wall_users SET email_verified_at=now() WHERE id=$1',[r.rows[0].user_id]);
   await result.query('UPDATE email_verifications SET used_at=now() WHERE token_hash=$1',[sha256(b.token)]);
   await result.query('COMMIT');res.json({data:{verified:true}});
 } catch(e){await result.query('ROLLBACK');throw e;}finally{result.release();}
}));
wallAuthRoutes.post('/login',handler(async(req,res)=>{
 await gate(req,'member-login',10,900);
 const b=z.object({email,password:z.string().min(1).max(128)}).parse(req.body);
 const r=await query('SELECT * FROM wall_users WHERE email=$1',[b.email]);const u=r.rows[0];
 if(!u?.active||!await verifyPassword(u.password_hash,b.password))throw new HttpError(401,'INVALID_CREDENTIALS','Invalid login');
 if(!u.email_verified_at)throw new HttpError(403,'EMAIL_NOT_VERIFIED','Verify email first');
 const identity:WallIdentity={type:'user',id:u.id,nickname:u.nickname,version:u.session_version};
 const token=await createWallSession(identity);
 res.json({data:{identity,token,expiresIn:tokenTTL()}});
}));
wallAuthRoutes.post('/forgot-password',handler(async(req,res)=>{
 await gate(req,'password-reset-request',4,3600);
 const b=z.object({email,turnstileToken:z.string().optional()}).parse(req.body);
 await verifyTurnstile(b.turnstileToken,req.ip);
 const r=await query('SELECT id FROM wall_users WHERE email=$1 AND active=true',[b.email]);
 if(r.rows[0]){
   const token=opaqueToken();
   await query('DELETE FROM password_resets WHERE user_id=$1',[r.rows[0].id]);
   await query("INSERT INTO password_resets(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 minutes')",[sha256(token),r.rows[0].id]);
   await sendPasswordResetMail(b.email,token);
 }
 res.json({data:{message:'If the account exists, a recovery email has been sent.'}});
}));
wallAuthRoutes.post('/reset-password',handler(async(req,res)=>{
 await gate(req,'password-reset',8,3600);
 const b=z.object({token:z.string().min(20).max(256),newPassword:password}).parse(req.body);
 const hashed=await hashPassword(b.newPassword);
 const result=await pool.connect();
 try {
   await result.query('BEGIN');
   const r=await result.query('SELECT user_id FROM password_resets WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE',[sha256(b.token)]);
   if(!r.rows[0])throw new HttpError(400,'TOKEN_INVALID','Recovery token invalid or expired');
   await result.query('UPDATE wall_users SET password_hash=$2,session_version=session_version+1 WHERE id=$1',[r.rows[0].user_id,hashed]);
   await result.query('UPDATE password_resets SET used_at=now() WHERE token_hash=$1',[sha256(b.token)]);
   await result.query('COMMIT');
   res.json({data:{passwordReset:true,reloginRequired:true}});
 }catch(e){await result.query('ROLLBACK');throw e;}finally{result.release();}
}));
wallAuthRoutes.post('/logout',requireWall,handler(async(req,res)=>{
 await redis.del(`wall:session:${sha256(req.headers.authorization!.slice(7))}`);res.json({data:{ok:true}});
}));
wallAuthRoutes.get('/me',requireWall,handler(async(_req,res)=>res.json({data:res.locals.wallUser})));
wallAuthRoutes.delete('/account',requireWall,handler(async(req,res)=>{
 const identity=res.locals.wallUser as WallIdentity;
 if(identity.type!=='user')throw new HttpError(403,'GUEST','Not a registered account');
 const b=z.object({password:z.string().min(1).max(128)}).parse(req.body);
 const r=await query('SELECT password_hash FROM wall_users WHERE id=$1',[identity.id]);
 if(!r.rows[0]||!await verifyPassword(r.rows[0].password_hash,b.password))throw new HttpError(403,'BAD_PASSWORD','Password incorrect');
 await query('DELETE FROM wall_users WHERE id=$1',[identity.id]);
 await query("UPDATE wall_messages SET nickname='Deleted user' WHERE author_type='user' AND author_ref=$1",[identity.id]);
 await redis.del(`wall:session:${sha256(req.headers.authorization!.slice(7))}`);
 res.json({data:{deleted:true}});
}));
