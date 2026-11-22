/** The public wall is open to guests, so a message may not carry anything that works as a link.
 *  Catches http(s)/www/ftp/javascript schemes, bare domains (example.com, bit.ly/x), and "dot com" style obfuscation. */
const SCHEME = /\b(?:https?|ftp|javascript|data|file)\s*:/i;
const WWW = /\bwww\s*\./i;
const TLDS = 'com|net|org|info|biz|io|co|me|pk|ly|gl|gg|cc|xyz|top|site|online|club|link|click|live|shop|app|dev|tv|ru|cn|tk|ml|ga|cf|gq|ws|vip|icu|buzz|rest|work|fun|store';
const BARE = new RegExp(`(?:^|[^a-z0-9@])[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\s*(?:\\.|\\(dot\\)|\\[dot\\]|\\bdot\\b)\\s*(?:${TLDS})(?![a-z0-9])`, 'i');
const SHORT = /\b(?:wa\.me|t\.me|bit\.ly|tinyurl|goo\.gl|discord\.gg)\b/i;
const EMAIL = /[a-z0-9._%+-]+\s*@\s*[a-z0-9-]+(?:\.[a-z0-9-]+)+/i;
export function containsLink(text: string): boolean {
  const t = text.normalize('NFKC');
  return SCHEME.test(t) || WWW.test(t) || SHORT.test(t) || EMAIL.test(t) || BARE.test(t);
}

/** Legacy stored messages predate write-time link rejection. Suppress them at read time
 * without deleting evidence used by moderators or audit investigations. */
export function filterPublicWallMessages<T extends {body:string}>(rows:T[]):T[] {
  return rows.filter(row=>typeof row.body==='string' && !containsLink(row.body));
}
