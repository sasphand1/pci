import { Router } from 'express';
import { z } from 'zod';
import { handler, HttpError } from '../../lib/errors.js';
import { requireAdmin, roles, type AdminIdentity } from '../auth/auth.js';
import { getRun, listRuns, startRefresh } from './service.js';
import { getCollectionSummary } from './summary.js';

export const refreshAdminRoutes = Router();
refreshAdminRoutes.use('/refresh', requireAdmin);

const body = z.object({ platforms: z.array(z.enum(['youtube', 'instagram'])).min(1).max(2).default(['youtube', 'instagram']) }).strict();

refreshAdminRoutes.post('/refresh', roles('owner', 'editor'), handler(async (req, res) => {
  const b = body.parse(req.body ?? {});
  const actor = (res.locals.admin as AdminIdentity | undefined)?.id ?? null;
  res.status(202).json({ data: { runs: await startRefresh(b.platforms, 'manual', actor) } });
}));
refreshAdminRoutes.get('/refresh', handler(async (_req, res) => { res.json({ data: await listRuns(20) }); }));
// Read-only and guarded by the existing admin session. Keep above /refresh/:id.
refreshAdminRoutes.get('/refresh/summary', handler(async (_req, res) => {
  res.json({ data: await getCollectionSummary() });
}));
refreshAdminRoutes.get('/refresh/:id', handler(async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  if (!id.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid id');
  const run = await getRun(id.data);
  if (!run) throw new HttpError(404, 'NOT_FOUND', 'Run not found');
  res.json({ data: run });
}));
