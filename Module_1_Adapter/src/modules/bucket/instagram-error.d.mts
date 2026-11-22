export type InstagramLookupFailure = { reason: 'resolve_error'; hint: string };
export function classifyInstagramLookupError(error: unknown): InstagramLookupFailure;
