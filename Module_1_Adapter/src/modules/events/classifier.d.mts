export const ENGINE_VERSION:string;
export const EVENT_CATEGORIES:readonly {id:string;label:string}[];
export const LEGACY_MAP:Readonly<Record<string,string>>;
export function canonicalCategory(value:unknown):string|null;
export type Classification={category:string;confidence:number;state:'suggested'|'needs_review';reason:string;engineVersion:string};
export function classifyEvent(value?:{name?:string;description?:string;venue?:string;sourceCategory?:string}):Classification;
