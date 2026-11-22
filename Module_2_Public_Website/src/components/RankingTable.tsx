import Link from 'next/link';
import {formatCount,safeCreatorImage} from '@/lib/format.mjs';
import {platformName,type PubRanking} from '@/lib/public';

/** A published ranking as a table. Ties show the same rank with an equals sign. */
export function RankingTable({ranking}:{ranking:PubRanking|null}){
 const rows=ranking?.entries??[];
 if(!ranking||!ranking.publishedAt)return <p className="muted pci-unified-empty">This ranking has not been published yet.</p>;
 if(!rows.length)return <p className="muted pci-unified-empty">Nobody has a fresh number for this ranking yet.</p>;
 return <div className="table-wrap pci-unified-white"><table className="data-table"><thead><tr><th scope="col">Rank</th><th scope="col">Creator</th><th scope="col" className="numeric">{ranking.unit}</th><th scope="col">Accounts</th></tr></thead><tbody>{rows.map(e=><tr key={e.person.slug}>
  <td><span className="rank-mark">{e.tied?'=':''}{e.rank}</span></td>
  <td><Link href={`/creators/${encodeURIComponent(e.person.slug)}`} className="identity">{safeCreatorImage(e.person.avatarUrl)?<img className="pci-unified-thumb" alt="" src={safeCreatorImage(e.person.avatarUrl)!}/>:<span className="pci-unified-avatar">{e.person.displayName.slice(0,1)}</span>}<span><strong>{e.person.displayName}</strong><small className="identity-sub">{e.person.categories.map(c=>c.label).join(', ')}</small></span></Link></td>
  <td className="numeric">{formatCount(e.value,true)}</td>
  <td><span className="pci-unified-links">{e.person.accounts.filter(a=>a.url).map(a=><a key={a.platform} className="pci-unified-platform-link" href={a.url!} target="_blank" rel="noopener noreferrer" aria-label={`Open ${e.person.displayName} on ${platformName(a.platform)}`} title={platformName(a.platform)}>{platformName(a.platform).slice(0,2)}</a>)}</span></td>
 </tr>)}</tbody></table></div>;
}
