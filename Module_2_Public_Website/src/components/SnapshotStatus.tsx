import {Badge,Notice} from '@pci/ui';
import {displayDate,isStale} from '@/lib/format.mjs';
export function SnapshotStatus({publishedAt}:{publishedAt:string|null|undefined}){
 return publishedAt?<div className="inline pci-snapshot-status"><Badge variant={isStale(publishedAt)?'danger':'normal'}>{isStale(publishedAt)?'Update pending':'Statistics available'}</Badge><span className="fineprint">Last updated: {displayDate(publishedAt)}</span></div>:<Notice tone="warning">Statistics will appear after the first successful data update.</Notice>;
}
