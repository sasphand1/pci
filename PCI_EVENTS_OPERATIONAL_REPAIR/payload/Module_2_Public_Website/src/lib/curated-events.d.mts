export interface CuratedEvent {
  readonly id:string;
  readonly name:string;
  readonly start_at:string;
  readonly end_at:string;
  readonly all_day:boolean;
  readonly city:string;
  readonly category:string;
  readonly venue:string;
  readonly latitude:number;
  readonly longitude:number;
  readonly description:string;
  readonly event_url:string;
  readonly organizer:string;
  readonly ticket_type:string;
  readonly price_text:string;
  readonly source_name:string;
}
export const CURATED_EVENTS_CHECKED_AT:string;
export const CURATED_EVENTS:readonly CuratedEvent[];
export function publishedCuratedEvents(now?:number):CuratedEvent[];
export function mergePublicEvents(fromBackend?:Array<Record<string,unknown>>,now?:number):Array<Record<string,unknown>|CuratedEvent>;
