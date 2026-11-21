import {adapterGet} from '@/lib/api';

// Shapes returned by /api/v1/public. Everything the site shows comes from rankings that were published.
export type PubAccount={platform:'youtube'|'instagram';handle:string;url:string|null};
export type PubPerson={slug:string;displayName:string;avatarUrl:string|null;categories:{slug:string;label:string}[];accounts:PubAccount[]};
export type PubEntry={slot:number;rank:number;tied:boolean;value:number;counted:number;contributions:{platform:string;value:number}[];person:PubPerson};
export type PubRanking={scope:string;kind:'wheel'|'platform'|'category';label:string;unit:string;publishedAt:string|null;stale:boolean;population:number;covered:number;entries:PubEntry[]};
export type PubRows={platforms:PubRanking[];categories:PubRanking[]};
export type PubCategory={slug:string;label:string;description:string|null;people:number;hasRanking:boolean};
export type PubStatus={publishedAt:string|null;stale:boolean;people:number};
export type PubFigures={platform:string;handle:string;url:string|null;followers:number|null;views:number|null;posts30d:number|null;observedAt:string|null};
export type PubPosition={scope:string;label:string;unit:string;slot:number;rank:number;value:number};
export type PubPersonDetail={slug:string;displayName:string;avatarUrl:string|null;categories:{slug:string;label:string}[];accounts:PubFigures[];positions:PubPosition[]};

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
