// Pure input parsing for the bucket. No database, network or config imports,
// so every rule here is covered by fast unit tests.

export type Platform = 'youtube' | 'instagram';
export const MAX_BULK_ROWS = 200;

export type Parsed =
  | { ok: true; kind: 'handle' | 'channel_id' | 'username'; value: string }
  | { ok: false; status: 'invalid_format'; hint: string };

const YT_CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const YT_HANDLE = /^[A-Za-z0-9._-]{3,30}$/;
const IG_USERNAME = /^[A-Za-z0-9._]{1,30}$/;
const IG_RESERVED = new Set(['p', 'reel', 'reels', 'explore', 'stories', 'tv', 'accounts', 'direct', 'about', 'tags', 'locations']);

const bad = (hint: string): Parsed => ({ ok: false, status: 'invalid_format', hint });

function asUrl(raw: string): URL | null {
  const s = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : /^(www\.|m\.)?(youtube\.com|youtu\.be|instagram\.com)\//i.test(raw) ? `https://${raw}` : null;
  if (!s) return null;
  try { return new URL(s); } catch { return null; }
}
const host = (u: URL) => u.hostname.toLowerCase().replace(/^(www|m)\./, '');

export function parseYoutubeInput(input: string): Parsed {
  const raw = input.trim();
  if (!raw) return bad('Empty input');
  const url = asUrl(raw);
  if (url) {
    if (host(url) !== 'youtube.com') return bad('Not a youtube.com link');
    const seg = url.pathname.split('/').filter(Boolean);
    if (seg[0]?.startsWith('@')) return parseYoutubeInput(decodeURIComponent(seg[0]));
    if (seg[0] === 'channel' && seg[1]) return YT_CHANNEL_ID.test(seg[1]) ? { ok: true, kind: 'channel_id', value: seg[1] } : bad('Channel id must look like UC followed by 22 characters');
    if (seg[0] === 'c' || seg[0] === 'user') return bad('Legacy /c/ and /user/ links cannot be resolved. Use the @handle or the /channel/UC… link');
    return bad('Use the channel @handle or /channel/UC… link');
  }
  if (YT_CHANNEL_ID.test(raw)) return { ok: true, kind: 'channel_id', value: raw };
  const h = raw.startsWith('@') ? raw.slice(1) : raw;
  if (!YT_HANDLE.test(h)) return bad('A YouTube handle has 3-30 letters, digits, dots, dashes or underscores');
  return { ok: true, kind: 'handle', value: h.toLowerCase() };
}

export function parseInstagramInput(input: string): Parsed {
  const raw = input.trim();
  if (!raw) return bad('Empty input');
  const url = asUrl(raw);
  let name = raw;
  if (url) {
    if (host(url) !== 'instagram.com') return bad('Not an instagram.com link');
    const seg = url.pathname.split('/').filter(Boolean);
    if (!seg[0] || IG_RESERVED.has(seg[0].toLowerCase())) return bad('This link is a post or a page, not a profile');
    name = seg[0];
  }
  if (name.startsWith('@')) name = name.slice(1);
  if (!IG_USERNAME.test(name)) return bad('An Instagram username has 1-30 letters, digits, dots or underscores');
  return { ok: true, kind: 'username', value: name.toLowerCase() };
}

export function parseAccountInput(platform: Platform, input: string): Parsed {
  return platform === 'youtube' ? parseYoutubeInput(input) : parseInstagramInput(input);
}

export type BulkRow = { index: number; line: number; raw: string; person?: string; niche?: string };
export type BulkParse = { rows: BulkRow[]; tooMany: boolean };

/** Line format: `account[, person[, niche]]`. Blank lines and lines starting with # are ignored. */
export function parseBulk(text: string): BulkParse {
  const rows: BulkRow[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t.startsWith('#')) continue;
    if (rows.length >= MAX_BULK_ROWS) return { rows, tooMany: true };
    const parts = t.split(',').map(s => s.trim());
    rows.push({ index: rows.length, line: i + 1, raw: parts[0], person: parts[1] || undefined, niche: parts[2] ? parts[2].toLowerCase() : undefined });
  }
  return { rows, tooMany: false };
}

export function normalizeName(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function slugify(name: string, fallback: string): string {
  const base = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 56);
  if (base.length >= 2) return base;
  const fb = fallback.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 56);
  return fb.length >= 2 ? fb : 'creator';
}

/** Returns a slug not in `taken`, appending -2, -3, ... and adds it to `taken`. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  let s = base, n = 2;
  while (taken.has(s)) s = `${base.slice(0, 56)}-${n++}`;
  taken.add(s);
  return s;
}
