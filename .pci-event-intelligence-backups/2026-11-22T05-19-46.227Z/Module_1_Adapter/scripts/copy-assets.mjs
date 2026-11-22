import { cp, mkdir, access } from 'node:fs/promises';
import { dirname } from 'node:path';
const runtimeModules=['modules/youtube/normalizers.mjs','modules/ranking/rank.mjs','modules/ranking/research.mjs','modules/instagram/ranking.mjs','modules/cross-platform/score.mjs','modules/unified/metrics.mjs','modules/engine/status.mjs','modules/satellite/catalog.mjs','modules/satellite/guard.mjs','modules/satellite/bulk.mjs','modules/satellite/feeds.mjs'];
for(const modulePath of runtimeModules){const source=`src/${modulePath}`,target=`dist/${modulePath}`;await access(source);await mkdir(dirname(target),{recursive:true});await cp(source,target);await access(target);console.info(`Copied runtime module: ${modulePath}`);}
