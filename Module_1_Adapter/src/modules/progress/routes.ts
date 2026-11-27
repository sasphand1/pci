import {Router} from 'express';
import {z} from 'zod';
import {query} from '../../lib/db.js';
import {handler,HttpError} from '../../lib/errors.js';
import {audit,requireAdmin,roles,type AdminIdentity} from '../auth/auth.js';

/** Admin "Progress" boards: one shared, versioned JSON state per board. Read: every admin role. Write: owner, editor. */
export const progressAdminRoutes=Router();
progressAdminRoutes.use('/progress',requireAdmin);

const slug=z.string().regex(/^[a-z0-9-]{2,60}$/);
const status=z.enum(['g','a','r','x']);
const coord=z.number().min(-10000).max(20000);
const limited=<T extends z.ZodTypeAny>(schema:T,max:number)=>z.record(z.string().max(80),schema).refine(v=>Object.keys(v).length<=max,{message:`At most ${max} entries`});
export const boardState=z.object({
 items:limited(z.object({status,note:z.string().max(2000).optional()}).strict(),600),
 texts:limited(z.string().max(300),600).refine(v=>Object.keys(v).every(k=>/^\d{1,5}$/.test(k)),{message:'Invalid text index'}),
 notes:z.array(z.object({id:z.string().regex(/^n\d{1,20}$/),x:coord,y:coord,text:z.string().min(1).max(1000),size:z.number().int().min(8).max(120),color:z.string().regex(/^#[0-9a-fA-F]{6}$/)}).strict()).max(200),
 arrows:z.array(z.object({id:z.string().regex(/^a\d{1,20}$/),x1:coord,y1:coord,x2:coord,y2:coord,st:status,label:z.string().max(200).optional(),note:z.string().max(2000).optional()}).strict()).max(200)
}).strict();
const putBody=z.object({version:z.number().int().min(0),state:boardState}).strict();

async function read(s:string){
 const r=await query(`SELECT b.state,b.version,b.updated_at AS "updatedAt",u.email AS "updatedBy"
   FROM progress_boards b LEFT JOIN admin_users u ON u.id=b.updated_by WHERE b.slug=$1`,[s]);
 return r.rows[0]??{state:null,version:0,updatedAt:null,updatedBy:null};
}

progressAdminRoutes.get('/progress/:slug',handler(async(req,res)=>{
 res.json({data:{slug:slug.parse(req.params.slug),...await read(slug.parse(req.params.slug))}});
}));

progressAdminRoutes.put('/progress/:slug',roles('owner','editor'),handler(async(req,res)=>{
 const s=slug.parse(req.params.slug);
 const b=putBody.parse(req.body);
 const actor=(res.locals.admin as AdminIdentity).id;
 const state=JSON.stringify(b.state);
 const r=b.version===0
  ? await query('INSERT INTO progress_boards(slug,state,version,updated_by) VALUES($1,$2::jsonb,1,$3) ON CONFLICT (slug) DO NOTHING RETURNING version',[s,state,actor])
  : await query('UPDATE progress_boards SET state=$2::jsonb,version=version+1,updated_by=$3,updated_at=now() WHERE slug=$1 AND version=$4 RETURNING version',[s,state,actor,b.version]);
 if(!r.rowCount)throw new HttpError(409,'STALE_BOARD','Someone else saved this board first. Reload to see their changes.');
 await audit(actor,'progress.update',s,{version:r.rows[0].version});
 res.json({data:{slug:s,...await read(s)}});
}));
