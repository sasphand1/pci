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
