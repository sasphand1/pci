/** Display-only status; never turns missing observations into modeled revenue. */
export function earningsStatusLabel(status) {
  switch(status) {
    case 'needs_history': return 'New tracking';
    case 'no_view_data': return 'No view data';
    case 'stale': return 'Data delayed';
    case 'invalid': return 'Unavailable';
    case 'no_youtube': return 'YT only';
    default: return 'No estimate';
  }
}
