import {NextResponse} from 'next/server';
import {parseCompare} from '@/lib/creators.mjs';
import {pubCreatorSlugs} from '@/lib/public';

export const dynamic='force-dynamic';
/** Same-origin read of up to four creators, so the browser never talks to the API host directly. */
export async function GET(request:Request){
  const slugs=parseCompare(new URL(request.url).searchParams.get('slugs'));
  if(!slugs.length)return NextResponse.json({data:[]});
  const data=await pubCreatorSlugs(slugs,true);
  return NextResponse.json({data},{headers:{'Cache-Control':'public, max-age=60'}});
}
