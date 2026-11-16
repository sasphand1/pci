import Link from 'next/link';
import type {Creator} from '@/lib/types';
import {displayDate,formatCount,safeYoutubeImage} from '@/lib/format.mjs';

export function HomeLeaderboard({creators,asOf}:{creators:Creator[];asOf:string|null}){
 const rows=creators.filter(c=>c.viewCount!==null).slice(0,10);
 if(!rows.length)return <div className="pci-leaderboard-empty"><h3>Rankings are being prepared</h3><p>Creator statistics will appear when a published data snapshot is available.</p></div>;
 return <div className="pci-leaderboard-scroll" role="region" aria-label="Top creator rankings by channel views" tabIndex={0}>
  <table className="pci-leaderboard-table"><thead><tr><th scope="col">#</th><th scope="col">Creator</th><th scope="col">Category</th><th scope="col" className="pci-col-num" aria-sort="descending">Channel views ↓</th><th scope="col" className="pci-col-num">Subscribers</th><th scope="col" className="pci-col-num">Videos</th><th scope="col">Last updated</th><th scope="col"><span className="sr-only">Profile</span></th></tr></thead>
   <tbody>{rows.map((creator,i)=>{const photo=safeYoutubeImage(creator.thumbnailUrl);const rank=creator.rank??i+1;const url=`/creators/${encodeURIComponent(creator.slug)}`;return <tr key={creator.id}>
    <td className="pci-table-rank"><span className={rank===1?'pci-rank-gold':undefined}>{rank}</span>{rank===1&&<span className="pci-table-crown" aria-label="Number one by channel views">♛</span>}</td>
    <td><Link href={url} className="pci-table-identity">{photo?<img src={photo} alt="" loading="lazy"/>:<span className="pci-table-monogram" aria-hidden="true">{creator.displayName.slice(0,1).toUpperCase()}</span>}<strong>{creator.displayName}</strong></Link></td>
    <td><span className="pci-category-chip">{creator.categories?.[0]?.label||'Creator'}</span></td>
    <td className="pci-col-num pci-main-metric">{formatCount(creator.viewCount,true)}</td>
    <td className="pci-col-num">{creator.subscriberHidden?'Hidden':formatCount(creator.subscriberCount,true)}</td>
    <td className="pci-col-num">{formatCount(creator.videoCount)}</td>
    <td className="pci-updated-col">{displayDate(creator.fetchedAt??asOf)}</td>
    <td><Link className="pci-profile-link" href={url}>View Profile <span aria-hidden="true">↗</span></Link></td>
   </tr>;})}</tbody></table>
 </div>;
}
