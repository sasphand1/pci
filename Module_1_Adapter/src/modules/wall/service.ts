import { Server } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import type { Request } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../lib/db.js';
import { redis,boundedLimit } from '../../lib/redis.js';
import { config } from '../../lib/config.js';
import { handler,HttpError } from '../../lib/errors.js';
import { sha256,pseudonym } from '../../lib/security.js';
import { requireWall,type WallIdentity } from '../auth/auth.js';

export const wallRoutes=Router();
let io:Server|null=null;
export function emitWall(event:string,data:unknown){io?.of('/wall').emit(event,data);}
export function attachWall(server:HttpServer){
 io=new Server(server,{cors:{origin:[config.PUBLIC_ORIGIN,config.ADMIN_ORIGIN],methods:['GET'],credentials:false},maxHttpBufferSize:20_000,
   allowRequest:(req,callback)=>{const origin=req.headers.origin;callback(null,!origin||[config.PUBLIC_ORIGIN,config.ADMIN_ORIGIN].includes(origin));}});
 const n=io.of('/wall');
 n.on('connection',async(socket)=>{
   const ip=socket.handshake.address;
   try{if(!await boundedLimit(`wall:socket:${pseudonym(ip)}`,30,60)){socket.disconnect(true);return;}}
   catch{socket.disconnect(true);return;}
   n.emit('wall:presence',{online:n.sockets.size,approximate:true});
   socket.on('disconnect',()=>n.emit('wall:presence',{online:n.sockets.size,approximate:true}));
 });
 return io;
}
export async function setting<T>(key:string):Promise<T> {
 const r=await query('SELECT value FROM app_settings WHERE key=$1',[key]);
 return r.rows[0]?.value as T;
}
async function isBanned(w:WallIdentity){
 const key=`${w.type}:${w.id}`;
 const r=await query('SELECT 1 FROM wall_bans WHERE subject_key=$1 AND (expires_at IS NULL OR expires_at>now())',[key]);
 return !!r.rowCount;
}
const messageSchema=z.object({body:z.string().trim().min(1).max(500)});
wallRoutes.get('/status',handler(async(_req,res)=>{
 res.json({data:{enabled:await setting<boolean>('wall_enabled'),readOnly:await setting<boolean>('wall_read_only'),retentionDays:config.WALL_MESSAGE_RETENTION_DAYS}});
}));
wallRoutes.get('/messages',handler(async(req,res)=>{
 const q=z.object({limit:z.coerce.number().int().min(1).max(100).default(50),before:z.string().datetime({offset:true}).optional()}).parse(req.query);
 const r=await query(`SELECT id,nickname,author_type AS "authorType",body,created_at AS "createdAt" FROM wall_messages
 WHERE deleted_at IS NULL AND created_at>now()-($1::int*interval '1 day') AND ($2::timestamptz IS NULL OR created_at<$2::timestamptz)
 ORDER BY created_at DESC,id DESC LIMIT $3`,[config.WALL_MESSAGE_RETENTION_DAYS,q.before??null,q.limit]);
 res.json({data:r.rows.reverse(),meta:{retentionDays:config.WALL_MESSAGE_RETENTION_DAYS}});
}));
wallRoutes.post('/messages',requireWall,handler(async(req,res)=>{
 const w=res.locals.wallUser as WallIdentity;
 if(!await setting<boolean>('wall_enabled')||await setting<boolean>('wall_read_only'))throw new HttpError(403,'WALL_CLOSED','Wall currently closed or read-only');
 if(await isBanned(w))throw new HttpError(403,'WALL_BANNED','You cannot post messages');
 const {body}=messageSchema.parse(req.body);
 if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(body))throw new HttpError(400,'INVALID_TEXT','Control characters not allowed');
 const lower=body.normalize('NFKC').toLocaleLowerCase();
 const blocked=(await setting<string[]>('wall_blocked_terms'))??[];
 if(blocked.some(word=>word && lower.includes(word.normalize('NFKC').toLocaleLowerCase())))throw new HttpError(400,'BLOCKED_TERM','Message contains blocked content');
 const key=`${w.type}:${w.id}`;
 if(!await boundedLimit(`wall:minute:${key}`,12,60))throw new HttpError(429,'SLOW_DOWN','Too many messages');
 const slow=await setting<number>('wall_slow_mode_seconds')??5;
 if(slow>0){const ok=await redis.set(`wall:cooldown:${key}`,'1','EX',slow,'NX');if(ok!== 'OK')throw new HttpError(429,'SLOW_MODE','Please wait before posting again');}
 const duplicate=await redis.set(`wall:duplicate:${key}:${sha256(lower)}`,'1','EX',120,'NX');
 if(duplicate!=='OK')throw new HttpError(429,'DUPLICATE','Repeated message blocked');
 const r=await query(`INSERT INTO wall_messages(author_type,author_ref,nickname,body) VALUES($1,$2,$3,$4)
 RETURNING id,nickname,author_type AS "authorType",body,created_at AS "createdAt"`,[w.type,w.id,w.nickname,body]);
 emitWall('wall:message_created',r.rows[0]);res.status(201).json({data:r.rows[0]});
}));
wallRoutes.post('/reports',requireWall,handler(async(req,res)=>{
 const w=res.locals.wallUser as WallIdentity;
 if(!await boundedLimit(`wall:report:${w.type}:${w.id}`,8,3600))throw new HttpError(429,'RATE_LIMIT','Too many reports');
 const b=z.object({messageId:z.string().uuid(),reason:z.string().trim().min(5).max(300)}).parse(req.body);
 const exists=await query('SELECT 1 FROM wall_messages WHERE id=$1 AND deleted_at IS NULL',[b.messageId]);
 if(!exists.rowCount)throw new HttpError(404,'NOT_FOUND','Message unavailable');
 const reporterRef=`${w.type}:${w.id}`;
 try{await query('INSERT INTO wall_reports(message_id,reporter_ref,reason) VALUES($1,$2,$3)',[b.messageId,reporterRef,b.reason]);}
 catch(e:any){if(e.code==='23505')throw new HttpError(409,'ALREADY_REPORTED','Already reported');throw e;}
 res.status(201).json({data:{reported:true}});
}));
