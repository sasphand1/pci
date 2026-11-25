import test from 'node:test';
import assert from 'node:assert/strict';
import {makeYoutubeProvider} from '../../src/providers/youtube.js';
import {normalizeResults} from '../../src/modules/refresh/normalize.js';
import type {AccountRef} from '../../src/providers/types.js';
const account:AccountRef={id:'fixture',platform:'youtube',externalId:'UC'+'a'.repeat(22),handle:'@fixture'};
const now=()=>new Date('2026-11-25T00:00:00Z');
async function read(count?:string){
 let calls=0;
 const provider=makeYoutubeProvider({channels:async()=>{calls++;return [{id:account.externalId,statistics:{subscriberCount:'10000',viewCount:'500000',videoCount:count},contentDetails:{relatedPlaylists:{uploads:'fixture'}}}]},uploadsPage:async()=>({published:[],next:undefined})},now);
 const result=normalizeResults([account],await provider.fetch([account]))[0];
 assert.equal(calls,1);
 assert.equal(result.outcome,'ok');
 assert.deepEqual(result.metrics.map(m=>m.metric),['views','followers','posts_30d']);
 return result.publicVideoCount;
}
test('normal YouTube refresh keeps the official video count without an extra API call or ranking metric',async()=>{assert.equal(await read('1983'),1983);assert.equal(await read('0'),0);});
test('missing and invalid video counts remain absent',async()=>{for(const n of [undefined,'','-1','1.5','invalid','9007199254740993'])assert.equal(await read(n),undefined);});
