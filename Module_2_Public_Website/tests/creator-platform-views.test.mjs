import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('the developer layout is the YouTube view; Instagram and TikTok get their own views',()=>{
 const s=read('../src/fifi/pages/creator.tsx');
 assert.match(s,/function YouTubeCreatorView\(/);assert.match(s,/function PlatformPendingView\(/);
 assert.match(s,/platform==='youtube'\?<YouTubeCreatorView \{\.\.\.props\} switcher=\{switcher\}\/>:<PlatformPendingView/);
 assert.match(s,/const order:ProfilePlatform\[\]=\['youtube','instagram','tiktok'\];const have=order\.filter\(p=>platforms\.includes\(p\)\)/);
 assert.doesNotMatch(s,/style=\{/);
});
test('the page passes the creator platforms and a validated ?platform= request',()=>{
 const s=read('../src/app/creators/[slug]/page.tsx');
 assert.match(s,/\/\^\(youtube\|instagram\|tiktok\)\$\/\.test\(requested\)/);
 assert.match(s,/<CreatorProfilePage platforms=\{/);
});
test('YouTube reference layout uses existing data and centralized styling',()=>{
 const s=read('../src/fifi/pages/creator.tsx'),page=read('../src/app/creators/[slug]/page.tsx'),css=read('../packages/ui/src/styles/creator-youtube.css'),view=read('../src/fifi/pages/youtube-reference.tsx');
 assert.match(s,/return <YouTubeReference/);
 assert.match(view,/pci-yt-reference/);
 assert.doesNotMatch(view,/style=\{/);
 assert.match(page,/\/rankings\/youtube\.subscribed\?limit=5/);
 assert.match(read('../packages/ui/src/styles.css'),/creator-youtube\.css/);
 assert.match(css,/\.pci-yt-reference \.yr-grid/);
});
