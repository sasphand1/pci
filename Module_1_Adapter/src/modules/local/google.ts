import { isAllowedMapsUrl, extractMapsName, looksLikeUrl, type Candidate } from './rules.mjs';

export type Place = Candidate & { address: string | null; area: string; mapsUrl: string | null };
export type Searcher = (text: string) => Promise<unknown[]>;

const LIST_FIELDS = 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus';
const ONE_FIELDS = 'id,displayName,formattedAddress,rating,userRatingCount,googleMapsUri,businessStatus';

/** One Google Places (New) text search. Asks only for the fields we show, to keep the cost down. */
export function googleSearcher(key: string, pageSize = 20): Searcher {
  return async (text) => {
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': LIST_FIELDS },
      body: JSON.stringify({ textQuery: text, includedType: 'restaurant', strictTypeFiltering: true, pageSize, languageCode: 'en', regionCode: 'PK' }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(`google_places_${r.status}`);
    return ((await r.json()) as { places?: unknown[] }).places ?? [];
  };
}

/** Fresh details for one known place id. */
export async function placeDetails(key: string, id: string): Promise<unknown | null> {
  const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=en`, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': ONE_FIELDS }, signal: AbortSignal.timeout(20000),
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`google_places_${r.status}`);
  return r.json();
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 300) : null);
export function toPlace(raw: any, area: string): Place | null {
  const id = str(raw?.id), name = str(raw?.displayName?.text);
  if (!id || !name) return null;
  return { id, name, rating: typeof raw.rating === 'number' ? raw.rating : NaN, reviews: typeof raw.userRatingCount === 'number' ? raw.userRatingCount : NaN,
    status: str(raw.businessStatus) ?? undefined, address: str(raw.formattedAddress), area, mapsUrl: str(raw.googleMapsUri) };
}

/** Turns what an admin pasted (a name, a full Maps link or a short Maps link) into a search phrase. Short links are followed a few hops, Google hosts only. */
export async function searchPhrase(input: string): Promise<string> {
  const text = input.trim();
  if (!looksLikeUrl(text)) return text.slice(0, 120);
  let url = text;
  for (let hop = 0; hop < 4; hop++) {
    if (!isAllowedMapsUrl(url)) throw new Error('not_a_maps_link');
    const name = extractMapsName(url);
    if (name) return name;
    const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PCI-admin)' } });
    const next = r.headers.get('location');
    if (!next) break;
    url = new URL(next, url).toString();
  }
  throw new Error('no_name_in_link');
}
