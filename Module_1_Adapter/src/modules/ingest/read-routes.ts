import type {Router} from 'express';
import {z} from 'zod';
import {handler,HttpError} from '../../lib/errors.js';
import {query} from '../../lib/db.js';
import {POLICY,isStale} from './policy.js';
import {runHubCheck} from './monitor.js';
import {creatorsBucketStatus} from '../creators-bucket/data.js';
import {roles} from '../auth/auth.js';

/** Tier boundaries used for coverage counts (subscribers/followers). */
export const TIERS=[{key:'1m_plus',min:1_000_000},{key:'500k_1m',min:500_000},{key:'100k_500k',min:100_000},{key:'under_100k',min:0}] as const;

/** Hub Read API: admin-only. Control-panel pages and consumers read hub data through these routes. */
export function registerHubReadRoutes(r:Router):void {
  r.get('/ingest/creators-bucket',handler(async(_req,res)=>res.json({data:await creatorsBucketStatus()})));
  r.get('/ingest/health',handler(async(_req,res)=>{
    const [sources,alerts,jobs,disc,stored]=await Promise.all([
      query(`SELECT s.id,s.platform,s.method,s.enabled,s.category,s.label,s.expected_hours AS "expectedHours",s.last_success_at AS "lastSuccessAt",s.last_attempt_at AS "lastAttemptAt",
        s.last_error AS "lastError",CASE WHEN NOT s.enabled THEN 'disabled' WHEN h.status='disabled' THEN 'degraded'
          ELSE COALESCE(h.status,'ok') END AS status,
        COALESCE(h.consecutive_failures,0) AS "consecutiveFailures",h.checked_at AS "checkedAt"
        FROM ingest_sources s LEFT JOIN hub_source_health h ON h.source_id=s.id ORDER BY s.id`),
      query(`SELECT id,created_at AS "createdAt",kind,scope,severity,source_id AS "sourceId",message FROM pipeline_alerts
        WHERE NOT acknowledged AND hub_key IS NOT NULL ORDER BY created_at DESC LIMIT 50`),
      query(`SELECT id,source_id AS "sourceId",trigger,status,started_at AS "startedAt",finished_at AS "finishedAt",error_code AS "errorCode"
        FROM ingest_jobs ORDER BY created_at DESC LIMIT 20`),
      query(`SELECT count(*)::int AS n FROM hub_discrepancies WHERE detected_at>now()-interval '7 days'`),
      query(`SELECT s.category,count(DISTINCT (l.entity_kind,l.entity_id))::int AS entities,count(*)::int AS fields,max(l.observed_at) AS "latestAt"
        FROM ingest_latest l JOIN ingest_sources s ON s.id=l.source_id GROUP BY s.category ORDER BY s.category`)
    ]);
    res.json({data:{sources:sources.rows,openAlerts:alerts.rows,recentJobs:jobs.rows,discrepancies7d:disc.rows[0].n,categories:stored.rows}});
  }));

  r.get('/ingest/alerts',handler(async(req,res)=>{
    const {state}=z.object({state:z.enum(['open','all']).default('open')}).parse(req.query);
    const rows=await query(`SELECT id,created_at AS "createdAt",kind,scope,severity,source_id AS "sourceId",message,acknowledged,resolved_at AS "resolvedAt"
      FROM pipeline_alerts WHERE hub_key IS NOT NULL ${state==='open'?'AND NOT acknowledged':''} ORDER BY created_at DESC LIMIT 200`);
    res.json({data:rows.rows});
  }));

  r.get('/ingest/discrepancies',handler(async(_req,res)=>{
    const rows=await query(`SELECT entity_kind AS "entityKind",entity_id AS "entityId",metric,api_value::text AS "apiValue",
      http_value::text AS "httpValue",detected_at AS "detectedAt" FROM hub_discrepancies ORDER BY detected_at DESC LIMIT 100`);
    res.json({data:rows.rows});
  }));

  /** Run the monitor now (also runs every 15 minutes in the worker). */
  r.post('/ingest/check',roles('owner','editor'),handler(async(_req,res)=>res.json({data:await runHubCheck()})));

  /** Registry coverage: accounts per platform by audience tier and primary category, plus freshness. */
  r.get('/ingest/coverage',handler(async(_req,res)=>{
    const base=`WITH latest AS (
        SELECT DISTINCT ON (o.account_id) o.account_id,o.value,o.observed_at FROM hub_account_metrics o
        WHERE o.metric='followers' ORDER BY o.account_id,o.observed_at DESC),
      acc AS (
        SELECT a.id,a.platform,a.avatar_url,l.value,l.observed_at,
          (SELECT c.slug FROM person_categories pc JOIN categories c ON c.id=pc.category_id
             WHERE pc.person_id=a.person_id AND pc.is_primary LIMIT 1) AS category
        FROM accounts a LEFT JOIN latest l ON l.account_id=a.id)`;
    const [tiers,cats,fresh]=await Promise.all([
      query(`${base} SELECT platform,CASE WHEN value IS NULL THEN 'no_data' WHEN value>=1000000 THEN '1m_plus'
          WHEN value>=500000 THEN '500k_1m' WHEN value>=100000 THEN '100k_500k' ELSE 'under_100k' END AS tier,count(*)::int AS n
        FROM acc GROUP BY 1,2 ORDER BY 1,2`),
      query(`${base} SELECT platform,COALESCE(category,'uncategorised') AS category,count(*)::int AS n,
          count(*) FILTER (WHERE value IS NULL)::int AS "noData" FROM acc GROUP BY 1,2 ORDER BY 1,3 DESC`),
      query(`${base} SELECT platform,count(*)::int AS registered,
          count(*) FILTER (WHERE observed_at>now()-interval '48 hours')::int AS fresh,
          count(*) FILTER (WHERE avatar_url IS NOT NULL)::int AS "withPicture",
          count(*) FILTER (WHERE value IS NULL)::int AS "noData" FROM acc GROUP BY 1 ORDER BY 1`)
    ]);
    res.json({data:{byTier:tiers.rows,byCategory:cats.rows,freshness:fresh.rows}});
  }));

  /** Latest hub values for one account, with age and staleness per field. */
  r.get('/ingest/account/:id',handler(async(req,res)=>{
    const id=z.string().uuid().parse(req.params.id);
    res.json({data:await accountView(id)});
  }));

  /** Side-by-side view of 2-3 accounts (used by the creator comparison screens). */
  r.get('/ingest/compare',handler(async(req,res)=>{
    const ids=z.string().transform(v=>v.split(',')).pipe(z.array(z.string().uuid()).min(2).max(3)).parse(req.query.ids);
    res.json({data:await Promise.all(ids.map(accountView))});
  }));
}

async function accountView(id:string){
  const a=await query<{id:string;platform:'youtube'|'instagram';external_id:string;handle:string;display_name:string}>(
    `SELECT a.id,a.platform,a.external_id,a.handle,p.display_name FROM accounts a JOIN people p ON p.id=a.person_id WHERE a.id=$1`,[id]);
  const acc=a.rows[0];if(!acc)throw new HttpError(404,'ACCOUNT_NOT_FOUND','Account not found');
  const entity=`${acc.platform}:${acc.external_id}`;
  const m=await query<{metric:string;value_numeric:string|null;value_text:string|null;accuracy:string;observed_at:string;source_id:string}>(
    `SELECT metric,value_numeric::text,value_text,accuracy,observed_at,source_id FROM ingest_latest WHERE entity_kind='account' AND entity_id=$1 ORDER BY metric`,[entity]);
  const win=POLICY[acc.platform].profileHours;
  const metrics=m.rows.map(x=>({metric:x.metric,value:x.value_numeric!==null?Number(x.value_numeric):x.value_text,accuracy:x.accuracy,
    observedAt:new Date(x.observed_at).toISOString(),sourceId:x.source_id,stale:isStale(x.observed_at,win)}));
  const top=await query(`SELECT c.content_id AS "contentId",c.title,c.published_at AS "publishedAt",c.url,c.thumbnail_url AS "thumbnailUrl",
      (SELECT value_numeric::text FROM ingest_latest l WHERE l.entity_kind='content' AND l.entity_id='youtube:'||c.content_id AND l.metric='views') AS views,
      (SELECT value_numeric::text FROM ingest_latest l WHERE l.entity_kind='content' AND l.entity_id='youtube:'||c.content_id AND l.metric='likes') AS likes,
      (SELECT value_numeric::text FROM ingest_latest l WHERE l.entity_kind='content' AND l.entity_id='youtube:'||c.content_id AND l.metric='comments') AS comments
    FROM ingest_content c WHERE c.account_id=$1 ORDER BY c.published_at DESC NULLS LAST LIMIT 10`,[id]);
  return {account:{id:acc.id,platform:acc.platform,handle:acc.handle,name:acc.display_name},metrics,
    recentContent:top.rows.map((r:any)=>({...r,views:r.views===null?null:Number(r.views),likes:r.likes===null?null:Number(r.likes),comments:r.comments===null?null:Number(r.comments)}))};
}
