import {cp, mkdir} from 'node:fs/promises';
await mkdir('dist/modules/ranking',{recursive:true});
await mkdir('dist/modules/youtube',{recursive:true});
await cp('src/modules/youtube/normalizers.mjs','dist/modules/youtube/normalizers.mjs');
await cp('src/modules/ranking/rank.mjs','dist/modules/ranking/rank.mjs');
await cp('src/modules/ranking/research.mjs','dist/modules/ranking/research.mjs');
