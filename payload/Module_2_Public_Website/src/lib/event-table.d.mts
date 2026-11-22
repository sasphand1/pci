export type PublicEventRow={
 id:string;name:string;city:string;start_at:string;start_ms:number;end_ms:number;all_day:boolean;category:string;venue:string;
 admission:'free'|'paid'|'unknown';source_name:string;source_url:string|null;latitude:number|null;longitude:number|null;
};
export type EventsFilter={city?:string;category?:string;window?:'all'|'week'|'month';search?:string};
export const EVENT_CITIES:readonly string[];
export const EVENT_CATEGORY_LABELS:Readonly<Record<string,string>>;
export function normalizePublicEvents(data:unknown,now?:number):PublicEventRow[];
export function filterPublicEvents(events:PublicEventRow[],filters?:EventsFilter,now?:number):PublicEventRow[];
export function eventCategoryLabel(category:string):string;
export function eventWazeUrl(event:PublicEventRow):string|null;
