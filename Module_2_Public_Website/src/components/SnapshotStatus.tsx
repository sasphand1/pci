import {Badge,Notice} from '@pci/ui';
import {displayDate,isStale} from '@/lib/format.mjs';
export function SnapshotStatus({publishedAt}:{publishedAt:string|null|undefined}){return publishedAt?<div className="inline"><Badge variant={isStale(publishedAt)?'danger':'normal'}>{isStale(publishedAt)?'May be out of date':'Latest published snapshot'}</Badge><span className="fineprint">Last updated: {displayDate(publishedAt)}</span></div>:<Notice tone="warning">No published YouTube snapshot is available yet. Statistics will appear after the first successful adapter refresh.</Notice>}
