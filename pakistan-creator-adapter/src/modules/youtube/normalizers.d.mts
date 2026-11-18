export function chunks<T>(items: T[],size: number): T[][];
export function countOrNull(v: unknown): string|null;
export function dateOrNull(v: unknown): string|null;
export function thumbUrl(v?: {thumbnails?: Record<string,{url:string}>}): string|null;
export function roundedMean(total:bigint|string,n:number): string|null;
