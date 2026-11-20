import { query } from '../../lib/db.js';
import { logger } from '../../lib/errors.js';
import { createRuns, processRun, type Deps } from '../refresh/service.js';
import { defaultProviders } from '../../providers/index.js';
import { buildBatch, publishBatch, recordAlert } from './service.js';

export type PipelineStep = { step: 'refresh' | 'rank' | 'publish'; status: 'ok' | 'partial' | 'failed' | 'skipped'; detail?: string };
type Trigger = 'manual' | 'scheduled' | 'system';
const realDeps = (): Deps => ({ providers: defaultProviders(), now: () => new Date(), sleep: ms => new Promise(r => setTimeout(r, ms)), backoff: n => Math.min(8000, 1000 * 2 ** (n - 1)), background: true });

/** One pipeline at a time, enforced by the database. A run stuck for over an hour is marked failed first. */
export async function createPipelineRun(trigger: Trigger, actorId: string | null): Promise<{ id: string; started: boolean }> {
  await query("UPDATE pipeline_runs SET status='failed', finished_at=now() WHERE status='running' AND created_at < now() - interval '60 minutes'");
  try {
    return { id: (await query('INSERT INTO pipeline_runs(trigger,created_by) VALUES($1,$2) RETURNING id', [trigger, actorId])).rows[0].id, started: true };
  } catch (e: any) {
    if (e?.code !== '23505') throw e;
    return { id: (await query("SELECT id FROM pipeline_runs WHERE status='running' ORDER BY created_at DESC LIMIT 1")).rows[0]?.id ?? '', started: false };
  }
}

/** Refresh -> Rank -> Publish. A failed refresh does not stop ranking (the freshness rule and the coverage gate
 * decide whether the data is good enough); a rejected draft leaves that scope's live ranking untouched and raises an alert. */
export async function executePipeline(id: string, trigger: Trigger, actorId: string | null, deps: Deps = realDeps()): Promise<'succeeded' | 'partial' | 'failed'> {
  const steps: PipelineStep[] = [];
  let status: 'succeeded' | 'partial' | 'failed' = 'succeeded';
  const save = (final = false) => query('UPDATE pipeline_runs SET steps=$2::jsonb, status=$3, finished_at=CASE WHEN $4 THEN now() ELSE NULL END WHERE id=$1', [id, JSON.stringify(steps), final ? status : 'running', final]);
  try {
    // 1. refresh
    try {
      const runs = await createRuns(['youtube', 'instagram'], trigger, actorId);
      const started = runs.filter(r => r.started);
      await Promise.all(started.map(r => processRun(r.runId, deps)));
      const done = started.length ? (await query('SELECT status FROM refresh_runs WHERE id=ANY($1::uuid[])', [started.map(r => r.runId)])).rows.map(r => r.status as string) : [];
      const notes = runs.filter(r => !r.started).map(r => `${r.platform} refresh was already running`);
      const failed = done.filter(s => s === 'failed').length, partial = done.filter(s => s === 'partial').length;
      steps.push({ step: 'refresh', status: failed === done.length && done.length ? 'failed' : failed || partial || notes.length ? 'partial' : 'ok', detail: [`${done.length} run(s)`, failed ? `${failed} failed` : '', partial ? `${partial} partial` : '', ...notes].filter(Boolean).join(', ') });
      if (steps[0].status !== 'ok') status = 'partial';
    } catch (e) { steps.push({ step: 'refresh', status: 'failed', detail: (e instanceof Error ? e.message : 'failed').slice(0, 150) }); status = 'partial'; }
    await save();
    // 2. rank
    let batchId: string;
    try { const b = await buildBatch(trigger, actorId); batchId = b.batchId; steps.push({ step: 'rank', status: 'ok', detail: `${b.drafts.length} scope(s) drafted` }); }
    catch (e) { steps.push({ step: 'rank', status: 'failed', detail: (e instanceof Error ? e.message : 'failed').slice(0, 150) }); steps.push({ step: 'publish', status: 'skipped' }); status = 'failed'; await recordAlert('pipeline_failed', null, 'Ranking failed; the live rankings were not changed'); await save(true); return status; }
    await save();
    // 3. publish
    try {
      const p = await publishBatch(batchId, actorId);
      steps.push({ step: 'publish', status: p.rejected.length ? 'partial' : 'ok', detail: `${p.published.length} published${p.rejected.length ? `, ${p.rejected.length} rejected by gates (live ranking kept)` : ''}` });
      if (p.rejected.length && status === 'succeeded') status = 'partial';
    } catch (e) { steps.push({ step: 'publish', status: 'failed', detail: (e instanceof Error ? e.message : 'failed').slice(0, 150) }); status = 'failed'; await recordAlert('pipeline_failed', null, 'Publishing failed; the live rankings were not changed'); }
  } catch (e) { logger.error({ err: e, id }, 'pipeline crashed'); status = 'failed'; }
  await save(true);
  return status;
}

/** Creates the run and, unless deps.background is false, runs it without blocking the caller. */
export async function startPipeline(trigger: Trigger, actorId: string | null, deps: Deps = realDeps()) {
  const run = await createPipelineRun(trigger, actorId);
  if (run.started && deps.background) setImmediate(() => { executePipeline(run.id, trigger, actorId, deps).catch(err => logger.error({ err }, 'pipeline run crashed')); });
  return run;
}
