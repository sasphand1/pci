import {redirect} from 'next/navigation';
export default async function ResetPassword({searchParams}:{searchParams:Promise<{token?:string}>}){const {token}=await searchParams;if(typeof token==='string'&&token.length<=256)redirect(`/account?reset=${encodeURIComponent(token)}`);redirect('/account');}
