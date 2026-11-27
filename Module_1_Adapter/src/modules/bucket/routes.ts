import { mountScrappaAdmin } from '../scrappa/admin.js';
import { Router } from 'express';
import { z } from 'zod';
import { handler, HttpError } from '../../lib/errors.js';
import { requireAdmin, roles, type AdminIdentity } from '../auth/auth.js';
import { commitBatch, deletePerson, listBucket, previewBatch, setCategories } from './service.js';

export const bucketAdminRoutes = Router();
bucketAdminRoutes.use('/bucket', requireAdmin);
mountScrappaAdmin(bucketAdminRoutes);

const actor = (res: { locals: Record<string, unknown> }) => (res.locals.admin as AdminIdentity | undefined)?.id ?? null;
const batch = z.object({ platform: z.enum(['youtube', 'instagram']), text: z.string().min(1).max(20000) }).strict();
const listQuery = z.object({
  platform: z.enum(['youtube', 'instagram']).optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0)
});
const id = z.string().uuid();

bucketAdminRoutes.get('/bucket', handler(async (req, res) => {
  res.json({ data: await listBucket(listQuery.parse(req.query)) });
}));
// Dry run: shows exactly what would happen to every line, writes nothing.
bucketAdminRoutes.post('/bucket/preview', roles('owner', 'editor'), handler(async (req, res) => {
  const b = batch.parse(req.body);
  res.json({ data: await previewBatch(b.platform, b.text) });
}));
bucketAdminRoutes.post('/bucket/people', roles('owner', 'editor'), handler(async (req, res) => {
  const b = batch.parse(req.body);
  res.status(201).json({ data: await commitBatch(b.platform, b.text, actor(res)) });
}));
bucketAdminRoutes.put('/bucket/people/:id/categories', roles('owner', 'editor'), handler(async (req, res) => {
  const body = z.object({ categories: z.array(z.string().regex(/^[a-z0-9-]{2,60}$/)).max(10), primary: z.string().nullable().default(null) }).strict().parse(req.body);
  res.json({ data: await setCategories(id.parse(req.params.id), body.categories, body.primary, actor(res)) });
}));
bucketAdminRoutes.delete('/bucket/people/:id', roles('owner'), handler(async (req, res) => {
  const pid = id.safeParse(req.params.id);
  if (!pid.success) throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid id');
  res.json({ data: await deletePerson(pid.data, actor(res)) });
}));
