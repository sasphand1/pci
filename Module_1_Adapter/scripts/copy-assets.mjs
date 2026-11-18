/** Copy runtime JavaScript modules that TypeScript does not emit.
 * Keep this list explicit so a missing production dependency fails the build.
 */
import { cp, mkdir, access } from 'node:fs/promises';
import { dirname } from 'node:path';

const runtimeModules = [
  'modules/youtube/normalizers.mjs',
  'modules/ranking/rank.mjs',
  'modules/ranking/research.mjs',
  'modules/instagram/ranking.mjs',
  'modules/cross-platform/score.mjs',
  'modules/unified/metrics.mjs',
];

for (const modulePath of runtimeModules) {
  const source = `src/${modulePath}`;
  const target = `dist/${modulePath}`;
  await access(source); // fail build immediately if source is absent
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target);
  await access(target); // fail build immediately if output is missing
  console.info(`Copied runtime module: ${modulePath}`);
}
