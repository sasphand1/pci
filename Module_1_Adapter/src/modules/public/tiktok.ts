import {Router} from 'express';
import {z} from 'zod';
import {query} from '../../lib/db.js';
import {handler} from '../../lib/errors.js';
import {metricOf,projectTikTok,rankTikTok,type TikTokRow} from './tiktok-rules.js';
export const publicTikTokRoutes=Router();
publicTikTokRoutes.get('/',handler(async(req,res)=>{
 const q=z.object({metric:z.string().optional(),search:z.string().trim().max(100).optional(),handle:z.string().regex(/^[a-z0-9._]{2,24}$/).optional(),person:z.string().regex(/^[a-z0-9-]{2,60}$/).optional(),page:z.coerce.number().int().min(1).max(10000).default(1),limit:z.coerce.number().int().min(1).max(100).default(24)}).parse(req.query);
 res.setHeader('Cache-Control','no-store');
 const r=await query(`SELECT s.external_id,s.handle,s.person_name,s.niche,s.published_at,p.slug AS person_slug,p.display_name AS linked_name,x.observed_at,x.profile,x.analytics FROM scrappa_candidates s LEFT JOIN people p ON p.id=s.person_id JOIN LATERAL (SELECT observed_at,profile,analytics FROM scrappa_snapshots WHERE external_id=s.external_id ORDER BY observed_at DESC,run_id DESC LIMIT 1) x ON true WHERE s.published_at IS NOT NULL`);
 const rows=rankTikTok(r.rows.map(x=>projectTikTok(x)).filter((x):x is TikTokRow=>x!==null),metricOf(q.metric));
 const search=q.search?.toLowerCase();const filtered=rows.filter(x=>(!q.person||x.personSlug===q.person)&&(!q.handle||x.handle===q.handle)&&(!search||`${x.displayName} ${x.handle}`.toLowerCase().includes(search)));
 res.json({data:filtered.slice((q.page-1)*q.limit,q.page*q.limit),pagination:{page:q.page,limit:q.limit,total:filtered.length,pages:Math.max(1,Math.ceil(filtered.length/q.limit))},policy:'tiktok.sampled.v1',source:'Scrappa'});
}));
