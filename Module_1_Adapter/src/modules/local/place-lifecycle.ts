import {skipRuntimeDDL} from '../../architecture/managed-runtime.js';
import type pg from 'pg';
import { query, transaction } from '../../lib/db.js';
import { HttpError } from '../../lib/errors.js';
import { bustPublicCache } from '../../lib/redis.js';
export const TOMBSTONE_SQL='CREATE TABLE IF NOT EXISTS local_place_tombstones (place_id text PRIMARY KEY);';
export async function ensureLocalPlaceLifecycle(){if(skipRuntimeDDL())return;await query(TOMBSTONE_SQL);}
export async function lockPlace(tx:pg.PoolClient,id:string){await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,731914))",[id]);}
export async function isDeleted(tx:pg.PoolClient,id:string){return Boolean((await tx.query('SELECT 1 FROM local_place_tombstones WHERE place_id=$1',[id])).rowCount);}
export async function purgePlace(id:string){
 await transaction(async tx=>{
  await lockPlace(tx,id);
  const exists=await tx.query('SELECT 1 FROM local_places WHERE place_id=$1',[id]);
  if(!exists.rowCount)throw new HttpError(404,'NOT_FOUND','Restaurant not found.');
  await tx.query('INSERT INTO local_place_tombstones(place_id) VALUES($1) ON CONFLICT DO NOTHING',[id]);
  const entity='google_places:'+id;
  await tx.query("DELETE FROM hub_discrepancies WHERE entity_kind='place' AND entity_id=$1",[entity]);
  await tx.query("DELETE FROM ingest_latest WHERE entity_kind='place' AND entity_id=$1",[entity]);
  await tx.query("DELETE FROM ingest_observations WHERE entity_kind='place' AND entity_id=$1",[entity]);
  await tx.query('DELETE FROM local_place_overrides WHERE place_id=$1',[id]);
  // Both restaurant_image_cache and restaurant_image_discovery cascade from local_places.
  await tx.query('DELETE FROM local_places WHERE place_id=$1',[id]);
 });
 await bustPublicCache();
}
