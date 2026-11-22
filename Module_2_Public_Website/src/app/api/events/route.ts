import {NextResponse} from 'next/server';
import {CURATED_EVENTS_CHECKED_AT,publishedCuratedEvents,mergePublicEvents} from '@/lib/curated-events.mjs';

export const dynamic='force-dynamic';
/**
 * Always retain approved adapter records. A small dated, independently sourced set
 * of official factual notices keeps the Pakistan map useful before the first feed
 * is configured, and during an adapter outage. No external provider is called by
 * the browser; provenance is included on each notice.
 *
 * The curated fallback is NOT represented as a real-time event feed. Every notice
 * expires automatically when its announced event window ends.
 */
export async function GET(){
  const api=(process.env.ADAPTER_INTERNAL_URL||process.env.NEXT_PUBLIC_ADAPTER_API_URL||'').replace(/\/$/,'');
  let backendStatus:'online'|'unconfigured'|'unavailable'='unconfigured';
  let upstreamEvents:Array<Record<string,unknown>>=[];
  let upstreamMeta:Record<string,unknown>={};
  if(/^https?:\/\//.test(api)){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),6500);
    try{
      const response=await fetch(`${api}/api/v1/public/events`,{
        headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal,
      });
      if(!response.ok)throw new Error(`Adapter HTTP ${response.status}`);
      const payload:unknown=await response.json();
      if(!payload||typeof payload!=='object'||!('data' in payload)||!Array.isArray(payload.data))throw new Error('Invalid adapter Events response');
      upstreamEvents=payload.data.filter((item):item is Record<string,unknown>=>Boolean(item&&typeof item==='object'&&!Array.isArray(item)));
      if('meta' in payload&&payload.meta&&typeof payload.meta==='object'&&!Array.isArray(payload.meta)){
        upstreamMeta=payload.meta as Record<string,unknown>;
      }
      backendStatus='online';
    }catch(error){
      backendStatus='unavailable';
      console.error('PCI Events adapter unavailable:',error instanceof Error?error.message:'unknown');
    }finally{clearTimeout(timeout);}
  }
  const curated=publishedCuratedEvents();
  const entries=mergePublicEvents(upstreamEvents);
  const meta={
    ...upstreamMeta,
    backend_status:backendStatus,
    backend_approved:upstreamEvents.length,
    editorial_verified:curated.length,
    editorial_checked_at:CURATED_EVENTS_CHECKED_AT,
    editorial_mode:'dated primary-source factual notices; not a live event feed',
  };
  // If neither backend nor curated notice is available, report the outage rather
  // than returning a misleading success with zero events.
  const status=backendStatus!=='online'&&entries.length===0?503:200;
  return NextResponse.json({data:entries,meta,...(status===503?{error:'EVENTS_BACKEND_UNAVAILABLE'}:{})},{status,headers:{'Cache-Control':'public, max-age=180, stale-while-revalidate=300'}});
}
