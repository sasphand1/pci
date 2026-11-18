import Link from 'next/link';
import {formatCount,safeYoutubeImage} from '@/lib/format.mjs';
import type {Creator} from '@/lib/types';
type Instagram={id:string;slug:string;username:string;displayName:string;followersCount:string|null;mediaCount:string|null;rank:number|null};
export function PlatformTopRows({youtube,instagram}:{youtube:Creator[];instagram:Instagram[]}){
 const yt=youtube.filter(x=>x.rank!=null).slice(0,10),ig=instagram.filter(x=>x.rank!=null).slice(0,10);
 return <section className="section pci-platform-rows">
  <div className="pci-platform-heading"><h2>Discover platform leaders</h2><p>Separate rankings from officially reported public counts. These are not cross-platform influence scores.</p></div>
  <div className="pci-platform-row"><div className="pci-platform-title"><h3>YouTube · Top 10</h3><Link href="/rankings?sort=views">View all →</Link></div><div className="pci-platform-scroller">{yt.map(c=><Link className="pci-platform-tile" href={`/creators/${encodeURIComponent(c.slug)}`} key={c.id}><span className="pci-platform-number">#{c.rank}</span>{safeYoutubeImage(c.thumbnailUrl)?<img src={safeYoutubeImage(c.thumbnailUrl)!} alt=""/>:<span className="pci-platform-placeholder">{c.displayName[0]}</span>}<strong>{c.displayName}</strong><small>{formatCount(c.viewCount,true)} channel views</small></Link>)}{!yt.length&&<p className="muted">YouTube rankings unavailable.</p>}</div></div>
  <div className="pci-platform-row"><div className="pci-platform-title"><h3>Instagram · Top 10</h3><span>Approved public professional profiles</span></div><div className="pci-platform-scroller">{ig.map(c=><a className="pci-platform-tile" href={`https://www.instagram.com/${encodeURIComponent(c.username)}/`} target="_blank" rel="noopener noreferrer" key={c.id}><span className="pci-platform-number">#{c.rank}</span><span className="pci-platform-placeholder">{c.displayName[0]}</span><strong>{c.displayName}</strong><small>{formatCount(c.followersCount,true)} followers</small><span className="pci-platform-external">Instagram profile ↗</span></a>)}{!ig.length&&<p className="muted">Approved Instagram statistics are not available yet.</p>}</div></div>
 </section>;
}
