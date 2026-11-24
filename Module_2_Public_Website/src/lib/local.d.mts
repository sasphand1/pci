import type { PubLocalCity, PubPlace } from './public';
export type LocalPlace = PubPlace & { city: string; cityLabel: string; pick: boolean };
export const LOCAL_SORTS: { id: string; label: string }[];
export const MAX_LOCAL_COMPARE: number;
export function flattenPlaces(cities: PubLocalCity[]): LocalPlace[];
export function filterPlaces(items: LocalPlace[], opts?: { city?: string; query?: string; sort?: string }): LocalPlace[];
export function splitPicks(items: LocalPlace[]): { picks: LocalPlace[]; ranked: LocalPlace[] };
export function placeKey(p: LocalPlace): string;
export function asOfShort(iso: string | null): string;
