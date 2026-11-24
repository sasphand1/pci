/** Reserve part of every Instagram metrics run for missing profile pictures.
 * The remaining slots always follow the least-recently-attempted rotation, so
 * prioritizing avatars never disables regular creator metric refreshes. */
export function instagramAvatarPrioritySlots(perRun: number): number {
  return Math.max(1, Math.ceil(perRun / 2));
}

/** Read-only account selector. All parameters are bound; no dynamic SQL fragments. */
export const INSTAGRAM_ACCOUNT_SELECTION_SQL = `
WITH eligible AS (
  SELECT a.id,a.external_id,a.handle,a.avatar_url,
    (SELECT MAX(rr.created_at) FROM refresh_results rr
     WHERE rr.account_id=a.id AND rr.detail IS DISTINCT FROM 'skipped_after_rate_limit') AS last_processed
  FROM accounts a WHERE a.platform=$1
),
avatar_priority AS (
  SELECT id FROM eligible
  WHERE avatar_url IS NULL OR btrim(avatar_url)=''
  ORDER BY last_processed ASC NULLS FIRST,id LIMIT $2
),
regular_rotation AS (
  SELECT id FROM eligible WHERE id NOT IN (SELECT id FROM avatar_priority)
  ORDER BY last_processed ASC NULLS FIRST,id
  LIMIT GREATEST(0,$3::int-(SELECT count(*)::int FROM avatar_priority))
)
SELECT e.id,e.external_id,e.handle FROM eligible e
JOIN (
  SELECT id,0 AS priority FROM avatar_priority
  UNION ALL SELECT id,1 AS priority FROM regular_rotation
) selected USING(id)
ORDER BY selected.priority,e.last_processed ASC NULLS FIRST,e.id`;
