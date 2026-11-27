/** Scrappa public creator collection. No scheduler, OAuth, or database side effects. */
const BASE = 'https://scrappa.co/api/tiktok/user/';
const MAX_BYTES = 4_000_000;
export type ReserveCredit = () => Promise<boolean>;
const count = (v: unknown): number | null => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null;
const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const str = (v: unknown): string | null => typeof v === 'string' && v.length ? v : null;
const id = (v: unknown): string | null => typeof v === 'string' && /^\d{1,30}$/.test(v) ? v : null;
export function username(v: string): string {
  const name = v.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9._]{2,24}$/.test(name)) throw new Error('invalid_username');
  return name;
}
export function parseProfile(body: unknown, handle: string) {
  const root = obj(body), data = obj(root.data), user = obj(data.user), stats = obj(data.stats);
  const accountId = id(user.id);
  if (root.code !== 0 || !accountId || str(user.uniqueId)?.toLowerCase() !== username(handle) || user.privateAccount !== false) throw new Error('profile_unverified');
  return { accountId, handle: username(handle), name: str(user.nickname), avatar: str(user.avatarMedium), verified: typeof user.verified === 'boolean' ? user.verified : null, bio: str(user.signature), followers: count(stats.followerCount), following: count(stats.followingCount), likes: count(stats.heartCount), posts: count(stats.videoCount) };
}
export function parsePosts(body: unknown, accountId: string, now = Date.now()) {
  const root = obj(body), data = obj(root.data);
  if (root.code !== 0 || !Array.isArray(data.videos)) throw new Error('posts_invalid');
  const seen = new Set<string>();
  const posts = [];
  for (const raw of data.videos) {
    const p = obj(raw), author = obj(p.author), postId = id(p.video_id), time = count(p.create_time);
    if (id(author.id) !== accountId) throw new Error('post_author_mismatch');
    if (!postId || seen.has(postId) || time === null || time * 1000 > now || p.is_top !== 0 || p.is_ad !== false || (count(p.duration) ?? 0) === 0) continue;
    seen.add(postId);
    posts.push({postId, publishedAt: new Date(time * 1000).toISOString(), views: count(p.play_count), likes: count(p.digg_count), comments: count(p.comment_count), shares: count(p.share_count), favorites: count(p.collect_count), downloads: count(p.download_count)});
  }
  return posts.sort((a,b) => b.publishedAt.localeCompare(a.publishedAt) || a.postId.localeCompare(b.postId)).slice(0,10);
}
export function summarize(posts: ReturnType<typeof parsePosts>) {
  const mean = (key: 'views'|'likes'|'comments'|'shares') => {
    const values = posts.map(p=>p[key]);
    if (values.length !== 10 || values.some(v=>v===null)) return null;
    const sum = values.reduce<number>((s,v)=>s+(v??0),0);
    return Number.isSafeInteger(sum) ? sum/values.length : null;
  };
  return {sampleSize: posts.length, averageViews:mean('views'), averageLikes:mean('likes'), averageComments:mean('comments'), averageShares:mean('shares')};
}
/** Reserve against a durable caller-owned quota BEFORE each request, including failures. No automatic retries. */
export async function collect(handle: string, apiKey: string, reserve: ReserveCredit, fetcher: typeof fetch = fetch) {
  const name = username(handle);
  if (!apiKey.trim()) throw new Error('scrappa_key_missing');
  async function request(endpoint: 'profile'|'posts', params: Record<string,string>) {
    if (!await reserve()) throw new Error('quota_exhausted');
    const url = new URL(BASE+endpoint); url.search = new URLSearchParams(params).toString();
    let response: Response;
    try { response = await fetcher(url,{headers:{'x-api-key':apiKey},redirect:'error',signal:AbortSignal.timeout(20000)}); }
    catch { throw new Error('scrappa_network_error'); }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`scrappa_http_${response.status}`); }
    const reader = response.body?.getReader(); if (!reader) throw new Error('scrappa_empty_body');
    const decoder = new TextDecoder(); let bytes=0, text='';
    try { for (;;) { const next=await reader.read(); if(next.done) break; bytes+=next.value.byteLength; if(bytes>MAX_BYTES){await reader.cancel();throw new Error('scrappa_body_limit');} text+=decoder.decode(next.value,{stream:true}); } text+=decoder.decode(); }
    finally {reader.releaseLock();}
    try {return JSON.parse(text) as unknown;} catch {throw new Error('scrappa_invalid_json');}
  }
  const profile = parseProfile(await request('profile',{unique_id:name}),name);
  const posts = parsePosts(await request('posts',{user_id:profile.accountId,count:'10',cursor:'0'}),profile.accountId);
  return {source:'scrappa.api',observedAt:new Date().toISOString(),profile,posts,analytics:summarize(posts)};
}
