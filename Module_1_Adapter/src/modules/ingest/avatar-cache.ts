import { query } from '../../lib/db.js';
import { logger } from '../../lib/errors.js';
import { AVATAR_MAX_BYTES, cacheHasRoom, looksBlocked, sniffImage } from './avatar-cache-rules.js';
import { downloadAvatar } from './avatar-download.js';

export type CacheResult = { status: 'done' | 'skipped'; reason?: string; tried: number; stored: number; failed: number };
type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; body: Uint8Array | null }>;

/** Stores a local copy of Instagram pictures. Talks only to Instagram's image servers,
 * not to the Graph API, so it does not use Meta API quota. */
export async function cacheInstagramAvatars(opts: { limit?: number; fetcher?: Fetcher } = {}): Promise<CacheResult> {
  const limit = Math.min(30, Math.max(1, Math.trunc(opts.limit ?? 20)));
  const fetcher = opts.fetcher ?? ((u: string) => downloadAvatar(u));
  const rows = await query<{ id: string; avatar_url: string }>(`
    SELECT a.id, a.avatar_url FROM accounts a
    LEFT JOIN avatar_cache c ON c.account_id=a.id
    LEFT JOIN avatar_cache_attempts t ON t.account_id=a.id
    WHERE a.platform='instagram' AND a.avatar_url IS NOT NULL AND btrim(a.avatar_url)<>''
      AND (c.account_id IS NULL OR c.source_url<>a.avatar_url)
      AND (t.last_attempt_at IS NULL OR t.last_attempt_at < now() - interval '6 hours')
    ORDER BY t.last_attempt_at ASC NULLS FIRST, a.id LIMIT $1`, [limit]);
  if (!rows.rows.length) return { status: 'skipped', reason: 'nothing_to_cache', tried: 0, stored: 0, failed: 0 };
  const used = await query<{ n: string }>('SELECT COALESCE(sum(size_bytes),0)::text AS n FROM avatar_cache');
  let total = Number(used.rows[0]?.n ?? 0);
  if (!cacheHasRoom(total, AVATAR_MAX_BYTES)) return { status: 'skipped', reason: 'cache_full', tried: 0, stored: 0, failed: 0 };
  const out: CacheResult = { status: 'done', tried: 0, stored: 0, failed: 0 };
  const results: string[] = [];
  for (const a of rows.rows) {
    out.tried++;
    const r = await fetcher(a.avatar_url);
    const kind = r.ok && r.body ? sniffImage(r.body) : null;
    const result = kind ? 'ok' : r.ok ? 'not_an_image' : `http_${r.status}`;
    results.push(result);
    await query(`INSERT INTO avatar_cache_attempts(account_id,attempts,last_attempt_at,last_result) VALUES($1,1,now(),$2)
      ON CONFLICT(account_id) DO UPDATE SET attempts=avatar_cache_attempts.attempts+1,last_attempt_at=now(),last_result=EXCLUDED.last_result`, [a.id, result]);
    if (kind && r.body) {
      await query(`INSERT INTO avatar_cache(account_id,source_url,content_type,bytes,size_bytes,fetched_at) VALUES($1,$2,$3,$4,$5,now())
        ON CONFLICT(account_id) DO UPDATE SET source_url=EXCLUDED.source_url,content_type=EXCLUDED.content_type,bytes=EXCLUDED.bytes,size_bytes=EXCLUDED.size_bytes,fetched_at=now()`,
        [a.id, a.avatar_url, kind.contentType, Buffer.from(r.body), r.body.length]);
      out.stored++; total += r.body.length;
      if (!cacheHasRoom(total, AVATAR_MAX_BYTES)) break;
    } else out.failed++;
  }
  if (looksBlocked(results)) logger.warn({ results }, 'Avatar cache: image servers refuse this host; keeping existing copies and original links');
  logger.info({ tried: out.tried, stored: out.stored, failed: out.failed }, 'Avatar cache run');
  return out;
}
