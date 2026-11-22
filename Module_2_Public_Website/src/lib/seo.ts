/** One authoritative public origin for canonical URLs and generated SEO routes.
 * Set NEXT_PUBLIC_SITE_URL to the final verified domain before making that site indexable.
 */
const DEFAULT_ORIGIN = 'https://darkcyan-wasp-393761.hostingersite.com';
export function siteOrigin(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!value) return DEFAULT_ORIGIN;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) return DEFAULT_ORIGIN;
    if (url.username || url.password || url.search || url.hash) return DEFAULT_ORIGIN;
    return url.origin;
  } catch { return DEFAULT_ORIGIN; }
}
export function canonicalPath(path: string): string {
  return new URL(path.startsWith('/') ? path : `/${path}`, `${siteOrigin()}/`).toString();
}
