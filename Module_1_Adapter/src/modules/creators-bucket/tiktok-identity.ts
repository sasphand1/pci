import {HttpError} from '../../lib/errors.js';
type Db={query(sql:string,values?:unknown[]):Promise<{rows:any[];rowCount:number|null}>};
type Choice={mode:'existing';personSlug:string;confirm:true}|{mode:'new';name:string;confirm:true};
/** Owner review only. A collected profile is evidence of an account, not proof of a cross-platform identity. */
export async function registerCentralTikTokIdentity(c:Db,id:string,choice:Choice,actorId:string|null){
 await c.query('SELECT pg_advisory_xact_lock(710324)');
 const s=(await c.query(`SELECT s.external_id,s.handle,s.person_id,s.published_at,s.niche,x.profile,x.observed_at
 FROM public.scrappa_candidates s JOIN LATERAL (SELECT profile,observed_at FROM public.scrappa_snapshots WHERE external_id=s.external_id ORDER BY observed_at DESC,run_id DESC LIMIT 1) x ON true
 WHERE s.external_id=$1 FOR UPDATE OF s`,[id])).rows[0];
 const at=Date.parse(s?.observed_at??'');
 if(!s||!Number.isFinite(at)||at>Date.now()||Date.now()-at>15*86400000||s.profile?.accountId!==id||s.profile?.handle!==s.handle||!Number.isSafeInteger(s.profile?.followers)||s.profile.followers<0)throw new HttpError(409,'PCI_TIKTOK_005','Collect a recent verified candidate profile before registration.');
 const old=(await c.query("SELECT id,person_id,handle FROM public.accounts WHERE platform='tiktok' AND external_id=$1 FOR UPDATE",[id])).rows[0];
 let personId:string;
 if(choice.mode==='existing'){
  const p=(await c.query('SELECT id FROM public.people WHERE slug=$1 FOR KEY SHARE',[choice.personSlug])).rows[0];
  if(!p)throw new HttpError(404,'PCI_TIKTOK_006','Existing People slug not found.');personId=p.id;
 }else{
  if(old||s.person_id)throw new HttpError(409,'PCI_TIKTOK_007','Candidate already has a linked identity; use its existing People slug.');
  if((await c.query("SELECT 1 FROM public.people WHERE lower(regexp_replace(trim(display_name),'\\s+',' ','g'))=lower(regexp_replace(trim($1),'\\s+',' ','g'))",[choice.name])).rowCount)throw new HttpError(409,'PCI_TIKTOK_008','An existing person has this name. Review the identity and link its exact slug instead.');
  personId=(await c.query('INSERT INTO public.people(slug,display_name,created_by) VALUES($1,$2,$3) RETURNING id',['tiktok-'+id,choice.name,actorId])).rows[0].id;
 }
 if(old&&(old.person_id!==personId||old.handle!==s.handle))throw new HttpError(409,'PCI_TIKTOK_003','Registered account identity differs; do not silently reassign it.');
 if(s.person_id&&s.person_id!==personId)throw new HttpError(409,'PCI_TIKTOK_003','Existing staged identity differs; review and unlink before changing.');
 if((await c.query('SELECT 1 FROM public.scrappa_candidates WHERE person_id=$1 AND external_id<>$2',[personId,id])).rowCount)throw new HttpError(409,'PCI_TIKTOK_009','Person already has another staged TikTok account.');
 if((await c.query("SELECT 1 FROM public.accounts WHERE platform='tiktok' AND person_id=$1 AND external_id<>$2",[personId,id])).rowCount)throw new HttpError(409,'PCI_TIKTOK_009','Person already has another registered TikTok account.');
 const accountId=old?.id??(await c.query("INSERT INTO public.accounts(person_id,platform,external_id,handle) VALUES($1,'tiktok',$2,$3) RETURNING id",[personId,id,s.handle])).rows[0].id;
 await c.query('UPDATE public.scrappa_candidates SET person_id=$2,published_at=COALESCE(published_at,now()) WHERE external_id=$1',[id,personId]);
 await c.query('INSERT INTO public.admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[actorId,'scrappa.registry.approve',id,JSON.stringify({personId,accountId,mode:choice.mode})]);
 return {personId,accountId,publicationApproved:true};
}
