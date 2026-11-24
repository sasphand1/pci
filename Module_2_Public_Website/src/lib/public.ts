import {adapterGet} from '@/lib/api';

// Shapes returned by /api/v1/public. Everything the site shows comes from rankings that were published.
export type PubAccount={platform:'youtube'|'instagram';handle:string;url:string|null};
export type PubEarningsStatus='ready'|'needs_history'|'no_view_data'|'stale'|'invalid'|'no_youtube';
export type PubPerson={slug:string;displayName:string;avatarUrl:string|null;estimatedMonthlyEarningsUsd?:number|null;earningsStatus?:PubEarningsStatus;earningsBasis?:'observed_view_gain'|'recent_uploads_floor'|null;instagramSponsorScenarioUsd?:number|null;categories:{slug:string;label:string}[];accounts:PubAccount[]};
export type PubEntry={slot:number;rank:number;tied:boolean;value:number;counted:number;contributions:{platform:string;value:number}[];person:PubPerson};
export type PubRanking={scope:string;kind:'wheel'|'platform'|'category';label:string;unit:string;publishedAt:string|null;stale:boolean;population:number;covered:number;entries:PubEntry[]};
export type PubRows={platforms:PubRanking[];categories:PubRanking[]};
export type PubCategory={slug:string;label:string;description:string|null;people:number;hasRanking:boolean};
export type PubCreatorAccount={platform:'youtube'|'instagram'|'tiktok';handle:string;url:string|null;followers:number|null;views:number|null;posts30d:number|null;asOf:string|null};
export type PubCreatorRow={slug:string;displayName:string;avatarUrl:string|null;categories:{slug:string;label:string}[];rank:number|null;totalFollowers:number|null;asOf:string|null;stale:boolean;accounts:PubCreatorAccount[];earningsUsd:number|null;earningsStatus:PubEarningsStatus;earningsBasis:'observed_view_gain'|'recent_uploads_floor'|null;instagramSponsorScenarioUsd:number|null;growth?:{subscribers:Record<'24h'|'7d'|'30d',number|null>;views:Record<'24h'|'7d'|'30d',number|null>};positions?:{scope:string;label:string;unit:string;rank:number;value:number}[]};
export type PubCreatorTotals={creators:number;youtube:number;instagram:number};
export type PubStatus={publishedAt:string|null;stale:boolean;people:number};
export type PubFigures={platform:string;handle:string;url:string|null;followers:number|null;views:number|null;posts30d:number|null;observedAt:string|null};
export type PubPosition={scope:string;label:string;unit:string;slot:number;rank:number;value:number};
export type PubVideoAnalytics={
  sampledVideos:number;averageViews:number|null;
  topVideos:{videoId:string;title:string;views:number;publishedAt:string|null}[];
  videos:{videoId:string;title:string;publishedAt:string|null;thumbnailUrl:string|null;currentViews:number|null;
    views24h:number|null;views7d:number|null;views30d:number|null;velocityPerHour:number|null;breakoutFactor:number|null}[];
};
export type PubCreatorAnalytics={
  video:PubVideoAnalytics;
  milestone:{target:number;estimatedDays:number|null}|null;
  estimatedMonthlyEarningsUsd:number|null;
  earningsStatus?:PubEarningsStatus;
  earningsBasis?:'observed_view_gain'|'recent_uploads_floor'|null;
  earningsMethod:string;
  instagramAccountCount?:number;
  instagramSponsorScenarioUsd?:number|null;
  instagramSponsorFollowers?:number|null;
  growth:{subscribers:Record<'24h'|'7d'|'30d',number|null>;views:Record<'24h'|'7d'|'30d',number|null>};
  history:{subscribers:{at:string;value:number}[];views:{at:string;value:number}[]};
  historyAccountCount:number;
};
export type PubPersonDetail={slug:string;displayName:string;avatarUrl:string|null;categories:{slug:string;label:string}[];accounts:PubFigures[];positions:PubPosition[];analytics?:PubCreatorAnalytics;similarCreators?:{slug:string;displayName:string}[]};

export const WHEEL_SCOPES=['wheel.subscribed','wheel.viewed','wheel.active'] as const;
export const SCOPE_PATTERN=/^(wheel\.(subscribed|viewed|active)|youtube\.subscribed|instagram\.followers|category\.[a-z0-9-]{2,60})$/;

export async function pubGet<T>(path:string):Promise<T|null>{
 const r=await adapterGet<{data:T}>(`/api/v1/public${path}`);
 return r?.data??null;
}
export async function pubList<T>(path:string):Promise<{data:T[];pagination:{page:number;limit:number;total:number;pages:number}}|null>{
 return adapterGet<{data:T[];pagination:{page:number;limit:number;total:number;pages:number}}>(`/api/v1/public${path}`);
}
export const platformName=(p:string)=>p==='youtube'?'YouTube':p==='instagram'?'Instagram':p;

export async function pubCreatorIndex(path:string){return adapterGet<{data:PubCreatorRow[];pagination:{page:number;limit:number;total:number;pages:number};totals:PubCreatorTotals}>(`/api/v1/public/creator-index${path}`);}
export async function pubCreatorSlugs(slugs:string[],detail=true){const r=await adapterGet<{data:PubCreatorRow[]}>(`/api/v1/public/creator-index?slugs=${encodeURIComponent(slugs.join(','))}&detail=${detail?1:0}`);return r?.data??[];}

export type PubPlace={rank:number|null;placeId:string;name:string;area:string|null;address:string|null;rating:number|null;reviewCount:number|null;mapsUrl:string|null;asOf:string|null;note:string|null};
export type PubLocalCity={slug:string;label:string;places:PubPlace[];picks:PubPlace[]};
export type PubLocal={data:PubLocalCity[];attribution:string;method:string};
export async function pubLocal(){return adapterGet<PubLocal>('/api/v1/public/local');}
