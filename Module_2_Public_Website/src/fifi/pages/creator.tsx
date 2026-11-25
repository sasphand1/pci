import type {Peer} from './youtube-profile-data.mjs';
import type {RealCreator} from '@/fifi/lib/real';
import type {PubCreatorAnalytics} from '@/lib/public';
import type {PubCreatorsBucket,CreatorAudience} from '@/lib/creators-bucket';

export type ProfilePlatform='youtube'|'instagram'|'tiktok';
export type CreatorProfileProps={creator:RealCreator;rank:string;rankLabel:string;
 accounts:{platform:string;handle:string;url:string|null;followers:string;followersCount?:number|null;views:string;posts30d:string;asOf:string}[];
 ytAccounts:{handle:string;url:string|null;followers:number|null;views:number|null;posts30d:number|null;asOf:string|null;avatarUrl?:string|null}[];
 analytics:Pick<PubCreatorAnalytics,'history'|'growth'|'video'|'historyAccountCount'>|null;
 creatorsBucket?:PubCreatorsBucket|null;creatorAudience?:CreatorAudience;ytRank?:string;
 comparison:{slug:string;name:string;value:number;self:boolean}[];comparisonPeers?:Peer[];rankingDate:string|null;
 platforms?:ProfilePlatform[];initialPlatform?:string|null};

export {CreatorProfilePage} from './creator-profile';
