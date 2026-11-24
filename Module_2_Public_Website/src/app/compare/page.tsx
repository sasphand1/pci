import {redirect} from 'next/navigation';
import {creatorsHref,parseCompare} from '@/lib/creators.mjs';

/** Comparison now lives on the Creators page; old links keep working. */
export default async function Compare({searchParams}:{searchParams:Promise<{left?:string;right?:string}>}){
 const {left='',right=''}=await searchParams;
 const compare=parseCompare(`${left},${right}`);
 redirect(creatorsHref({compare,open:compare.length>=2}));
}
