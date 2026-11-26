import type {Metadata} from 'next';
import {FifiPage} from '@/fifi/FifiPage';
import {adapterGet} from '@/lib/api';
import {SatifyPage,type SatifyPack,type SatifyMeta,type SatifyValue} from '@/components/SatifyPage';
export const metadata:Metadata={title:'Pulsr Signals',description:'Pakistan’s air, weather, fog, prices and alerts from free scientific and official sources. Every number shows its source and time. Join packs on WhatsApp.'};
export const dynamic='force-dynamic';
export default async function Satify(){
 const [packs,now]=await Promise.all([
  adapterGet<{data:SatifyPack[];meta:SatifyMeta}>('/api/v1/satify/packs'),
  adapterGet<{data:SatifyValue[];meta:{scopeName:string;badges:Record<string,string>}}>('/api/v1/satify/now?city=lahore'),
 ]);
 return <FifiPage><main className="page-main pb-10 pt-5">
  <SatifyPage packs={packs?.data??[]} meta={packs?.meta??null} initialCity="lahore" initialValues={now?.data??[]} badges={now?.meta?.badges??null}/>
 </main></FifiPage>;
}
