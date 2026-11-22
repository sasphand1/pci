// Error messages deliberately contain only diagnostic codes, never access tokens or Meta response bodies.
export function classifyInstagramLookupError(error) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'INSTAGRAM_GRAPH_NOT_CONFIGURED')
    return { reason: 'resolve_error', hint: 'Instagram API is not configured. Check the Graph token and owner ID on the backend.' };
  if (message === 'INSTAGRAM_GRAPH_INVALID_RESPONSE')
    return { reason: 'resolve_error', hint: 'Instagram returned incomplete or inconsistent profile statistics.' };
  if (message === 'INVALID_USERNAME')
    return { reason: 'resolve_error', hint: 'The submitted Instagram username failed API input validation.' };
  const match = /^INSTAGRAM_GRAPH_ERROR_(\d+)$/.exec(message);
  if (match) {
    const code = Number(match[1]);
    if (code === 190 || code === 102)
      return { reason: 'resolve_error', hint: `Instagram API authentication failed (Meta code ${code}). Check or renew the token.` };
    if ([10, 200, 201, 299].includes(code))
      return { reason: 'resolve_error', hint: `Instagram API permission denied (Meta code ${code}). Check app permissions, account access and review status.` };
    if (code === 4 || code === 17 || code === 32 || code === 613 || code === 429)
      return { reason: 'resolve_error', hint: `Instagram API rate limit or quota reached (code ${code}). Retry after quota recovers.` };
    if (code >= 500)
      return { reason: 'resolve_error', hint: `Instagram API server error (${code}). Retry later.` };
    // Graph code 100 and similar codes can represent malformed fields, permission issues,
    // or unavailable targets. None alone proves an account is private/personal/nonexistent.
    return { reason: 'resolve_error', hint: `Instagram Business Discovery failed (Meta code ${code}). Inspect server-side Graph diagnostics; account eligibility is unconfirmed.` };
  }
  if (message === 'The operation was aborted' || error?.name === 'TimeoutError' || error?.name === 'AbortError')
    return { reason: 'resolve_error', hint: 'Instagram lookup timed out. Retry later.' };
  return { reason: 'resolve_error', hint: 'Instagram lookup failed. Check backend logs and Meta API configuration.' };
}
