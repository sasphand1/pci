import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const base=path.join(root,'Module_2_Public_Website');
const pagePath=path.join(base,'src/app/page.tsx');
const rowsPath=path.join(base,'src/components/CreatorDiscoveryRows.tsx');
const cssPath=path.join(base,'packages/ui/src/styles/discovery-rows.css');
for(const p of [pagePath,rowsPath,cssPath])if(!fs.existsSync(p))throw new Error(`Missing ${p}. Extract at PCI_Clean root.`);
const replaceOnce=(s,a,b,name)=>{if(s.includes(b))return s;if(!s.includes(a))throw new Error(`Expected ${name} source pattern missing; no files changed.`);return s.replace(a,b)};
let page=fs.readFileSync(pagePath,'utf8');
let rows=fs.readFileSync(rowsPath,'utf8');
let css=fs.readFileSync(cssPath,'utf8');
// Safe validation: calculate all replacements before writing any file.
page=replaceOnce(page,
 'const [rankingResponses,overviewResponses,status,categories,siteConfig,platformYoutube,platformInstagram]=await Promise.all([',
 'const [rankingResponses,overviewResponses,status,categories,siteConfig,platformYoutube,platformInstagram,curatedYoutube]=await Promise.all([',
 'homepage Promise.all destructuring');
page=replaceOnce(page,
 "  adapterGet<UnifiedRankingResponse>('/api/v1/unified/rankings?metric=subscribers&platform=instagram&limit=100')\n ]);",
 "  adapterGet<UnifiedRankingResponse>('/api/v1/unified/rankings?metric=subscribers&platform=instagram&limit=100'),\n  adapterGet<{data:Creator[]}>('/api/v1/rankings?sort=subscribers&limit=100')\n ]);",
 'homepage curated YouTube fetch');
page=replaceOnce(page,
 '<CreatorDiscoveryRows categories={categories?.data??[]} youtube={platformYoutube?.data??[]} instagram={platformInstagram?.data??[]}/>',
 '<CreatorDiscoveryRows categories={categories?.data??[]} youtube={platformYoutube?.data??[]} instagram={platformInstagram?.data??[]} curatedYoutube={curatedYoutube?.data??[]}/>',
 'discovery row props');
rows=replaceOnce(rows,
 "import type {Category} from '@/lib/types';",
 "import type {Category,Creator} from '@/lib/types';",
 'Creator type import');
rows=replaceOnce(rows,
 "import {useRef,useState} from 'react';",
 "import {useEffect,useRef,useState} from 'react';",
 'useEffect import');
rows=replaceOnce(rows,
 "function PanelRail({title,summary,children,empty}:{title:string;summary:string;children:ReactNode;empty:boolean}){\n const scroller=useRef<HTMLDivElement>(null);",
 "function PanelRail({title,summary,children,empty,startAtEnd=false}:{title:string;summary:string;children:ReactNode;empty:boolean;startAtEnd?:boolean}){\n const scroller=useRef<HTMLDivElement>(null);\n useEffect(()=>{if(startAtEnd&&scroller.current)scroller.current.scrollLeft=scroller.current.scrollWidth;},[startAtEnd,children]);",
 'rail auto-scroll');
rows=replaceOnce(rows,
 'export function CreatorDiscoveryRows({categories,youtube,instagram}:{categories:Category[];youtube:UnifiedPerson[];instagram:UnifiedPerson[]}){',
 'export function CreatorDiscoveryRows({categories,youtube,instagram,curatedYoutube}:{categories:Category[];youtube:UnifiedPerson[];instagram:UnifiedPerson[];curatedYoutube:Creator[]}){',
 'row typed props');
rows=replaceOnce(rows,
 ' const yt=youtube.filter(p=>Boolean(p.platforms?.youtube)&&p.subscriberCount!==null&&included(p.categories)).slice(0,20);',
 " // Use real, enabled YouTube channel snapshots for the editorial YouTube row.\n // Unified approval continues to govern the cross-platform ranking wheel and Top 100.\n const yt=curatedYoutube.filter(p=>p.subscriberCount!==null&&!p.subscriberHidden&&included(p.categories)).slice(0,20).reverse();",
 'YouTube channel filtering');
rows=replaceOnce(rows,
 '  <PanelRail title="YouTube" summary="Top 20 verified YouTubers · subscribers" empty={!yt.length}>\n    {yt.map(p=><Link key={p.id} className="pci-discovery-person" href={`/creators/${encodeURIComponent(p.slug)}`}>\n     <div className="pci-discovery-avatar">{safeYoutubeImage(p.thumbnailUrl)?<img loading="lazy" alt="" src={safeYoutubeImage(p.thumbnailUrl)!}/>:<span>{p.displayName.slice(0,1)}</span>}<span className="pci-discovery-chip">YouTube</span></div>\n     <div className="pci-discovery-caption"><strong>{p.displayName}</strong><span>{formatCount(p.subscriberCount,true)} YouTube subscribers</span></div>\n    </Link>)}\n   </PanelRail>',
 '  <PanelRail title="YouTube" summary="Top 20 tracked YouTube channels · subscribers · #20 to #1" empty={!yt.length} startAtEnd>\n    {yt.map(p=><Link key={p.id} className="pci-discovery-person" href={`/creators/${encodeURIComponent(p.slug)}`}>\n     <div className="pci-discovery-avatar">{safeYoutubeImage(p.thumbnailUrl)?<img loading="lazy" alt="" src={safeYoutubeImage(p.thumbnailUrl)!}/>:<span>{p.displayName.slice(0,1)}</span>}<span className="pci-discovery-chip">YouTube</span><span className="pci-discovery-rank" aria-label={`Rank ${p.rank??"unranked"}`}>#{p.rank??"—"}</span></div>\n     <div className="pci-discovery-caption"><strong>{p.displayName}</strong><span>{formatCount(p.subscriberCount,true)} subscribers</span></div>\n    </Link>)}\n   </PanelRail>',
 'YouTube Netflix rail');
rows=replaceOnce(rows,
 ' * Each source ranking is calculated independently from its platform\'s reported\n * subscriber/follower metric. Client-side category filtering preserves rank order.\n * Up to 20 verified people per row, never 20 fabricated profiles.',
 " * The YouTube row uses raw subscriber rankings from the curated YouTube API.\n * Instagram remains sourced from the human-approved unified API.\n * No fabricated channel statistics are introduced.",
 'rail data policy comment');
rows=replaceOnce(rows,
 'Top 20 on each platform, ranked by verified subscribers or followers. Swipe horizontally to browse.',
 'YouTube: top tracked channels by subscriber count, from #20 to #1. Instagram: approved individuals. Swipe horizontally to browse.',
 'description text');
rows=replaceOnce(rows,
 'Only admin-approved individual human creators with linked YouTube accounts appear. The rows each show a maximum of 20 verified profiles.',
 'The YouTube row lists enabled, curated channels with reported subscriber counts; unified rankings and Instagram continue to require human approval. Each row displays up to 20 profiles.',
 'disclaimer');
if(!css.includes('.pci-discovery-rank{')) css += '\n/* YouTube reverse-ranked Netflix rail: rank overlay on existing cards. */\n.pci-discovery-rank{position:absolute;right:9px;top:9px;background:#071b2fe8;color:#fff;border:1px solid #ffffff52;border-radius:8px;padding:5px 9px;font-size:.9rem;font-weight:900;box-shadow:0 3px 10px #0006}\n.pci-discovery-person:has(.pci-discovery-rank) {scroll-snap-align:end}\n';
for(const [p,content] of [[pagePath,page],[rowsPath,rows],[cssPath,css]]){
 const original=fs.readFileSync(p,'utf8');
 if(original===content){console.log(`Unchanged ${path.relative(root,p)}`);continue;}
 fs.copyFileSync(p,`${p}.pci-youtube-rail-backup`);
 fs.writeFileSync(p,content);
 console.log(`Updated ${path.relative(root,p)} (backup saved)`);
}
console.log('YouTube Netflix rail patch installed. Run npm run check in Module_2_Public_Website.');
