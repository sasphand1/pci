export type CrossInput={instagramCreatorId:string;youtubeCreatorId:string;username:string;youtubeSlug:string;displayName:string;curated:boolean;enabled:boolean;eligibility:string;subscriberCount:string|null;viewCount:string|null;followersCount:string|null;thumbnailUrl?:string|null;[key:string]:unknown};
export type CrossOutput=CrossInput&{score:number;breakdown:{youtubeSubscribers:number;youtubeViews:number;instagramFollowers:number;youtubePlatform:number};rank:number;tiedWith:number};
export function rankCrossPlatform(rows:CrossInput[],options?:{limit?:number}):CrossOutput[];
