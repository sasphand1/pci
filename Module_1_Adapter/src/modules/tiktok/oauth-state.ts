import {query} from '../../lib/db.js';
import {hashState} from './core.mjs';
export type ClaimedState={person_id:string;expected_username:string};
/** Single statement: wrong admin, expired state and replay never consume valid state. */
export async function claimOAuthState(state:string,adminId:string):Promise<ClaimedState|null>{
 return (await query<ClaimedState>(`UPDATE tiktokingest.oauth_states SET used_at=now(),expires_at=GREATEST(expires_at,now()+interval '2 minutes')
 WHERE state_hash=$1 AND admin_id=$2 AND used_at IS NULL AND expires_at>now() RETURNING person_id,expected_username`,[hashState(state),adminId])).rows[0]??null;
}
/** Delete consumed state after the exchange; a deleted state cannot be replayed. */
export async function finishOAuthState(state:string,adminId:string):Promise<void>{
 await query('DELETE FROM tiktokingest.oauth_states WHERE state_hash=$1 AND admin_id=$2 AND used_at IS NOT NULL',[hashState(state),adminId]);
}
