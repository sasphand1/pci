import Link from 'next/link';
import {notFound} from 'next/navigation';
import {FifiPage} from '@/fifi/FifiPage';
import {TikTokDirectory} from '@/components/TikTokDirectory';
export const dynamic='force-dynamic';
export default async function TikTokProfile({params}:{params:Promise<{handle:string}>}){
 const {handle}=await params;
 if(!/^[a-z0-9._]{2,24}$/.test(handle))notFound();
 return <FifiPage><main className="page-main pb-10 pt-5"><Link href="/creators?platform=tiktok" className="mb-4 block text-sm text-primary">Back to TikTok rankings</Link><TikTokDirectory handle={handle}/></main></FifiPage>;
}
