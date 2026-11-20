export type Role='owner'|'editor'|'moderator';
export interface AdminIdentity {id:string;email:string;role:Role;csrfToken:string}
export interface Creator {
 id:string;channel_id:string;slug:string;display_name:string;description:string;featured:boolean;enabled:boolean;
 category_ids:string[];created_at?:string;updated_at?:string;
}
export interface Category {id:string;slug:string;label:string;description:string;display_order:number;active:boolean}
export interface SyncRun {
 id:string;source:'manual'|'scheduled';status:string;created_at:string;started_at:string|null;finished_at:string|null;
 quota_used:number;channel_count:number;video_count:number;error_code:string|null;error_message?:string|null;
}
export interface Dashboard {
 creators:{total:number;enabled:number}; statistics:{total:number;newest:string|null};videos:{total:number};
 recentSyncRuns:SyncRun[];pendingReports:number;activeAdmins:number;wallMessages24h:number;
}
export interface Health {database:string;databaseTime:string;redis:string;syncEnabled:boolean;quotaEstimatedLast24h:number;youtubeKeyConfigured:boolean}
export interface RankedCreator {id:string;channelId:string;displayName:string;subscriberCount:string|null;viewCount:string|null;videoCount:string|null;rank:number|null;rankMetric:string}
export interface Video {video_id:string;title:string;published_at:string|null;fetched_at:string;display_on_site:boolean;display_name:string;views:string|null}
export interface WallMessage {id:string;author_type:'guest'|'user';author_ref:string;nickname:string;body:string;created_at:string;deleted_at:string|null}
export interface WallReport {id:string;message_id:string;reason:string;status:'pending'|'resolved'|'dismissed';created_at:string;nickname:string;body:string;deleted_at:string|null}
export interface AdminUser {id:string;email:string;role:Role;active:boolean;created_at:string;last_login_at:string|null}
export interface AuditEntry {id:string;actor_id:string|null;action:string;subject:string|null;metadata:Record<string,unknown>;created_at:string}
export interface Setting {key:string;value:unknown}

// PCI_ZIP_3: bucket, refresh and publication
export type Platform='youtube'|'instagram';
export interface BucketAccount {id:string;platform:Platform;handle:string;externalId:string}
export interface BucketCategory {slug:string;label:string;primary:boolean}
export interface BucketPerson {id:string;slug:string;displayName:string;createdAt:string;accounts:BucketAccount[];categories:BucketCategory[]}
export interface BucketList {total:number;rows:BucketPerson[]}
export type RowStatus='resolved'|'invalid_format'|'not_found'|'unsupported_account_type'|'resolve_error'|'duplicate_in_bucket'|'duplicate_in_batch'|'unknown_niche'|'person_already_has_platform';
export interface BatchRow {index:number;line:number;input:string;status:RowStatus;addable:boolean;hint?:string;handle?:string;person?:string;niche?:string}
export interface BatchResult {rows:BatchRow[];summary:{total:number;addable:number;counts:Record<string,number>};added?:number}
export interface RefreshRun {id:string;platform:Platform;trigger:string;status:string;createdAt:string;startedAt:string|null;finishedAt:string|null;counts:Record<string,number>;error:string|null}
export interface RefreshResultRow {accountId:string;platform:Platform;handle:string;outcome:string;attempts:number;detail:string|null}
export interface StartedRun {platform:Platform;runId:string;started:boolean;reason?:string}
export interface GateFailure {gate:string;message:string}
export interface DiffPerson {personId:string;displayName:string}
export interface ScopeDraft {
 runId:string;scope:string;status:'draft'|'published'|'superseded'|'rejected';createdAt:string;population:number;covered:number;unranked:number;gateFailures:GateFailure[];hasLive:boolean;
 top:{slot:number;rank:number;personId:string;displayName:string;value:number;counted:number;linked:number}[];
 diff:{entered:(DiffPerson&{to:number})[];left:(DiffPerson&{from:number})[];moved:(DiffPerson&{from:number;to:number;delta:number})[];counts:{entered:number;left:number;moved:number;valueChanged:number;unchanged:number}};
}
export interface RankBatch {batchId:string;scopes:ScopeDraft[]}
export interface PublishOutcome {published:string[];rejected:{scope:string;failures:GateFailure[]}[]}
export interface PipelineStep {step:string;status:string;detail?:string}
export interface PipelineStatus {
 worker:{kind:string;lastSeenAt:string;healthy:boolean}|null;dailyRun:{enabled:boolean;schedule:string};bucket:{people:number;youtube:number;instagram:number};
 refresh:{platform:Platform;id:string;status:string;createdAt:string;finishedAt:string|null;counts:Record<string,number>;error:string|null}[];
 pipeline:{id:string;trigger:string;status:string;createdAt:string;finishedAt:string|null;steps:PipelineStep[]}[];
 alerts:{id:number;createdAt:string;kind:string;scope:string|null;message:string}[];
 live:{scope:string;publishedAt:string;population:number|null;covered:number;ageHours:number|null;stale:boolean}[];
}
export interface LivePublication {
 scope:string;publishedAt:string|null;population:number;covered:number;
 entries:{slot:number;rank:number;personId:string;displayName:string;value:number;counted:number;linked:number}[];
 unranked:{personId:string;displayName:string;reason:string;linked:number}[];
}
