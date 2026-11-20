// Fetches REAL metrics for a few accounts and prints one line per account. Writes nothing anywhere.
// Usage (from Module_1_Adapter, with your .env present):
//   npm run smoke:live -- yt:@somechannel yt:UCxxxxxxxxxxxxxxxxxxxxxx ig:someusername
// Needs YOUTUBE_API_KEY for yt: and INSTAGRAM_GRAPH_ACCESS_TOKEN + INSTAGRAM_GRAPH_OWNER_ID for ig:.
// Secrets are never printed.
import { YoutubeClient } from '../src/modules/youtube/client.ts';
import { makeYoutubeProvider } from '../src/providers/youtube.ts';
import { makeInstagramProvider } from '../src/providers/instagram.ts';

const args = process.argv.slice(2);
if (!args.length) { console.error('Give 1-5 accounts, e.g. yt:@handle ig:username'); process.exit(2); }
if (args.length > 5) { console.error('At most 5 accounts per run'); process.exit(2); }

const client = new YoutubeClient();
const yt = makeYoutubeProvider(client);
const ig = makeInstagramProvider();
let bad = 0;

for (const arg of args) {
  const [kind, raw] = [arg.slice(0, arg.indexOf(':')), arg.slice(arg.indexOf(':') + 1)];
  try {
    let result;
    if (kind === 'yt') {
      let id = raw;
      if (!/^UC[A-Za-z0-9_-]{22}$/.test(raw)) {
        const ch = await client.channelByHandle(raw.replace(/^@/, ''));
        if (!ch) { console.log(`${arg.padEnd(34)} not_found (no channel with that handle)`); bad++; continue; }
        id = ch.id;
      }
      [result] = await yt.fetch([{ id: 'smoke', platform: 'youtube', externalId: id, handle: raw }]);
    } else if (kind === 'ig') {
      [result] = await ig.fetch([{ id: 'smoke', platform: 'instagram', externalId: 'smoke', handle: raw.replace(/^@/, '') }]);
    } else { console.log(`${arg.padEnd(34)} skipped (use yt: or ig:)`); bad++; continue; }
    const m = Object.fromEntries(result.metrics.map(x => [x.metric, x.value + (x.accuracy === 'rounded3' ? ' (rounded)' : '') + (x.capped ? ' (capped)' : '')]));
    console.log(`${arg.padEnd(34)} ${result.outcome.padEnd(13)} ${JSON.stringify(m)} ${result.detail ?? ''}`);
    if (result.outcome !== 'ok') bad++;
  } catch (e) {
    console.log(`${arg.padEnd(34)} error ${(e instanceof Error ? e.message : 'failed').slice(0, 100)}`); bad++;
  }
}
console.log(bad ? `\n${bad} of ${args.length} did not return values. The outcome column says why.` : `\nAll ${args.length} returned values.`);
process.exit(0);
