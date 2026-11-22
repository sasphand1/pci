import {displayDate,isStale} from '@/lib/format.mjs';
export function SnapshotStatus({publishedAt}:{publishedAt:string|null|undefined}){
 return publishedAt
  ? <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className={`rounded-full px-2.5 py-1 font-semibold ${isStale(publishedAt)?'bg-red-100 text-red-800':'bg-primary/10 text-primary'}`}>{isStale(publishedAt)?'May be out of date':'Latest published snapshot'}</span><span>Last updated: {displayDate(publishedAt)}</span></div>
  : <p className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">No published YouTube snapshot is available yet. Statistics will appear after the first successful adapter refresh.</p>;
}
