// Retires the old public ranking endpoints without deleting anything. Set PCI_LEGACY_PUBLIC=true to bring them back.
const PUBLIC_LEGACY = [/^\/creators(\/|$)/, /^\/rankings$/, /^\/overview$/, /^\/unified(\/|$)/, /^\/instagram\/rankings$/, /^\/cross-platform\/top$/];
const ADMIN_LEGACY = [/^\/admin\/unified\/(creators|bulk-review)/, /^\/admin\/instagram(\/|$)/, /^\/admin\/cross-platform(\/|$)/];

/** `path` is relative to /api/v1 (for example "/creators/some-slug"). */
export function isLegacyPath(path: string): boolean {
  const p = path.split('?')[0].replace(/\/+$/, '') || '/';
  return PUBLIC_LEGACY.some(r => r.test(p)) || ADMIN_LEGACY.some(r => r.test(p));
}
export const legacyEnabled = (env: Record<string, string | undefined> = process.env) => env.PCI_LEGACY_PUBLIC === 'true';

type Req = { path: string }; type Res = { status: (n: number) => { json: (b: unknown) => unknown } }; type Next = () => unknown;
export function legacyGate(enabled: () => boolean = () => legacyEnabled()) {
  return (req: Req, res: Res, next: Next) => {
    if (enabled() || !isLegacyPath(req.path)) return next();
    return res.status(410).json({ error: { code: 'LEGACY_RETIRED', message: 'This endpoint was replaced. Use /api/v1/public (see /docs).' } });
  };
}
