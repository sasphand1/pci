export const EXCLUSION_REASONS:ReadonlyArray<string>;
export type CreatorStatusInput={enabled:boolean;humanReviewStatus:string;fetchedAt:string|Date|null;subscriberCount:string|null;subscriberHidden:boolean|null;lastOutcome:string|null;[key:string]:unknown};
export type Classification={eligible:boolean;reasons:string[];primary:string|null};
export function classifyCreator(c:CreatorStatusInput,options?:{now?:Date;maxAgeHours?:number}):Classification;
export function summarize<T extends CreatorStatusInput>(rows:T[],options?:{now?:Date;maxAgeHours?:number}):{total:number;eligible:number;ineligible:number;byReason:Record<string,number>;byPrimaryReason:Record<string,number>;creators:Array<T&Classification>};
