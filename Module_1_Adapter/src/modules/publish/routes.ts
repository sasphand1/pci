import { Router } from 'express';
import { z } from 'zod';
import { handler, HttpError } from '../../lib/errors.js';
import { query } from '../../lib/db.js';
import { requireAdmin, roles, type AdminIdentity } from '../auth/auth.js';
import { startPipeline } from './pipeline.js';
import { activeRefreshCount, buildBatch, getBatch, getPublication, latestBatchId, listPublications, publishBatch, rollbackScope } from './service.js';
import { getPipelineStatus } from './status.js';
import { getOverview } from './overview.js';

export const publishAdminRoutes = Router();
publishAdminRoutes.use(['/rank', '/pipeline', '/publications', '/overview'], requireAdmin);

const actor = (res: { locals: Record<string, unknown> }) => (res.locals.admin as AdminIdentity | undefined)?.id ?? null;
const uuid = z.string().uuid();
const scopeSchema = z.string().regex(/^(wheel\.(subscribed|viewed|active)|youtube\.subscribed|instagram\.followers|category\.[a-z0-9-]{2,60})$/);

// Rank: build drafts for every scope. Nothing becomes public.
publishAdminRoutes.post('/rank', roles('owner', 'editor'), handler(async (_req, res) => {
  if (await activeRefreshCount() > 0) throw new HttpError(409, 'REFRESH_RUNNING', 'Numbers are still being collected. Wait until the refresh has finished, then rank.');
  const b = await buildBatch('manual', actor(res));
  res.status(201).json({ data: { batchId: b.batchId, scopes: b.drafts.length, gateFailures: b.drafts.filter(d => d.gateFailures.length).length } });
}));
publishAdminRoutes.get('/rank/latest', handler(async (_req, res) => {
  const id = await latestBatchId();
  res.json({ data: id ? await getBatch(id) : null });
}));
publishAdminRoutes.get('/rank/:batchId', handler(async (req, res) => { res.json({ data: await getBatch(uuid.parse(req.params.batchId)) }); }));
publishAdminRoutes.post('/rank/:batchId/publish', roles('owner', 'editor'), handler(async (req, res) => { res.json({ data: await publishBatch(uuid.parse(req.params.batchId), actor(res)) }); }));

// Pipeline: refresh, rank, publish in one go.
publishAdminRoutes.post('/pipeline/run', roles('owner', 'editor'), handler(async (_req, res) => { res.status(202).json({ data: await startPipeline('manual', actor(res)) }); }));
// Overview: one read-only call for the home page (all roles).
publishAdminRoutes.get('/overview', handler(async (_req, res) => { res.json({ data: await getOverview() }); }));
publishAdminRoutes.get('/pipeline/status', handler(async (_req, res) => { res.json({ data: await getPipelineStatus() }); }));
publishAdminRoutes.post('/pipeline/alerts/ack-all', roles('owner', 'editor'), handler(async (_req, res) => {
  const r = await query('UPDATE pipeline_alerts SET acknowledged=true WHERE NOT acknowledged');
  res.json({ data: { acknowledged: r.rowCount ?? 0 } });
}));
publishAdminRoutes.post('/pipeline/alerts/:id/ack', roles('owner', 'editor'), handler(async (req, res) => {
  const id = z.coerce.number().int().positive().safeParse(req.params.id);
  if (!id.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid id');
  await query('UPDATE pipeline_alerts SET acknowledged=true WHERE id=$1', [id.data]);
  res.json({ data: { acknowledged: true } });
}));

// Live (published) rankings.
publishAdminRoutes.get('/publications', handler(async (_req, res) => { res.json({ data: await listPublications() }); }));
publishAdminRoutes.get('/publications/:scope', handler(async (req, res) => {
  const limit = z.coerce.number().int().min(1).max(200).default(100).parse(req.query.limit);
  res.json({ data: await getPublication(scopeSchema.parse(req.params.scope), limit) });
}));
publishAdminRoutes.post('/publications/:scope/rollback', roles('owner', 'editor'), handler(async (req, res) => { res.json({ data: await rollbackScope(scopeSchema.parse(req.params.scope), actor(res)) }); }));
