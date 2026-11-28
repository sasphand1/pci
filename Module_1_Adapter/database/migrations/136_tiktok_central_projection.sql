-- Read-only promotion: retain raw Scrappa evidence, expose only explicitly linked and approved accounts.
-- No identities are created or inferred by migration. No historical observations are copied or rewritten.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.accounts'::regclass AND conname='accounts_platform_chk' AND pg_get_constraintdef(oid) NOT LIKE '%tiktok%') THEN
  ALTER TABLE public.accounts DROP CONSTRAINT accounts_platform_chk;
  ALTER TABLE public.accounts ADD CONSTRAINT accounts_platform_chk CHECK (platform IN ('youtube','instagram','tiktok'));
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_tiktok_username_uq ON public.accounts(lower(ltrim(handle,'@'))) WHERE platform='tiktok';
CREATE OR REPLACE VIEW public.hub_tiktok_registered AS
SELECT a.id AS account_id,p.id AS person_id,p.created_at AS person_created_at,p.slug AS person_slug,p.display_name AS linked_name,
 'tiktok:'||a.external_id AS entity_id,s.external_id,s.handle,s.person_name,s.niche,s.published_at,x.observed_at,
 jsonb_build_object('handle',s.handle,'accountId',s.external_id,'avatar',x.profile->'avatar',
  'followers',m.metrics->'followers','following',m.metrics->'following','likes',m.metrics->'likes','posts',m.metrics->'video_count') AS profile,
 jsonb_build_object('sampleSize',m.metrics->'sample_size','averageViews',m.metrics->'average_views',
  'averageLikes',m.metrics->'average_likes','averageComments',m.metrics->'average_comments','averageShares',m.metrics->'average_shares') AS analytics,
 m.metrics
FROM public.scrappa_candidates s JOIN public.people p ON p.id=s.person_id
JOIN public.accounts a ON a.person_id=p.id AND a.platform='tiktok' AND a.external_id=s.external_id AND a.handle=s.handle
JOIN LATERAL (SELECT run_id,observed_at,profile FROM public.scrappa_snapshots WHERE external_id=s.external_id ORDER BY observed_at DESC,run_id DESC LIMIT 1) x ON true
JOIN LATERAL (SELECT jsonb_object_agg(l.metric,l.value_numeric::numeric/power(10::numeric,l.value_scale)) AS metrics
 FROM public.ingest_latest l JOIN public.ingest_observations o ON o.source_id=l.source_id AND o.source_run_ref=x.run_id::text
 AND o.entity_kind=l.entity_kind AND o.entity_id=l.entity_id AND o.metric=l.metric AND o.observed_at=l.observed_at
 AND o.value_numeric=l.value_numeric AND o.value_scale=l.value_scale AND o.accuracy=l.accuracy
 WHERE l.source_id='scrappa.api' AND l.entity_kind='account' AND l.entity_id='tiktok_candidate:'||s.external_id
 AND l.observed_at=x.observed_at AND l.account_id IS NULL AND o.account_id IS NULL AND o.raw_metadata->>'stage'='candidate'
 AND o.raw_metadata->>'candidateId'=s.external_id AND l.value_numeric BETWEEN 0 AND 9007199254740991
 AND ((l.metric IN ('followers','following','likes','video_count','sample_size') AND l.value_scale=0 AND l.accuracy='exact')
 OR (l.metric IN ('average_views','average_likes','average_comments','average_shares') AND l.value_scale=1 AND l.accuracy='rounded'))) m ON true
WHERE s.published_at IS NOT NULL AND s.external_id ~ '^[0-9]{1,30}$' AND s.handle ~ '^[a-z0-9._]{2,24}$'
 AND x.profile->>'accountId'=s.external_id AND x.profile->>'handle'=s.handle
 AND m.metrics ? 'followers';
