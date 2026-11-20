import type { Aggregated } from './aggregate.js';
import type { Entry } from './types.js';

/** `slot` is the unique position 1..N. `rank` is competition ranking: 1 + the number of people with a
 * strictly greater value, so equal values share a rank (1, 1, 3). Input must already be ordered. */
export function assignSlots(ordered: Aggregated[]): Entry[] {
  const out: Entry[] = [];
  let rank = 1;
  ordered.forEach((row, i) => {
    if (i > 0 && row.value !== ordered[i - 1].value) rank = i + 1;
    out.push({ slot: i + 1, rank, personId: row.personId, value: row.value, counted: row.counted, linked: row.linked, breakdown: row.breakdown });
  });
  return out;
}
