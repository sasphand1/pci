import type {Metadata} from 'next';
import {FifiPage} from '@/fifi/FifiPage';
import {adapterGet} from '@/lib/api';
import {SatelliteDashboard} from '@/components/SatelliteDashboard';
import {SatifyPage,type SatifyPack,type SatifyMeta,type SatifyValue} from '@/components/SatifyPage';
export const metadata:Metadata={title:'Satify: Satisfy yourself',description:'Pakistan’s air, weather, fog, prices and alerts from free scientific and official sources. Every number shows its source and time. Join packs on WhatsApp.'};
export const dynamic='force-dynamic';
export default async function Satify(){
 const [packs,now,sources,fires,rain,solar]=await Promise.all([
  adapterGet<{data:SatifyPack[];meta:SatifyMeta}>('/api/v1/satify/packs'),
  adapterGet<{data:SatifyValue[];meta:{scopeName:string;badges:Record<string,string>}}>('/api/v1/satify/now?city=lahore'),
  adapterGet<{data:unknown[]}>('/api/v1/satellite/sources'),
  adapterGet<{data:unknown[]}>('/api/v1/satellite/fires/latest?limit=100'),
  adapterGet<{data:unknown[]}>('/api/v1/satellite/rainfall/latest?city=lahore'),
  adapterGet<{data:unknown[]}>('/api/v1/satellite/solar/latest?city=lahore')
 ]);
 return <FifiPage><main className="page-main pb-10 pt-5">
  <SatifyPage packs={packs?.data??[]} meta={packs?.meta??null} initialCity="lahore" initialValues={now?.data??[]} badges={now?.meta?.badges??null}/>
  <section className="satify-section" aria-labelledby="satify-satellite"><h2 id="satify-satellite" className="satify-h2">From space</h2>
   <p className="satify-muted">Fires, rainfall, sunlight, rivers and alerts from NASA, Copernicus and UN sources. Same data Satify uses, shown in full.</p>
   <div className="pci-sat-shell"><SatelliteDashboard sources={sources?.data??[]} fires={fires?.data??[]} rain={rain?.data??[]} solar={solar?.data??[]}/></div>
  </section>
 </main></FifiPage>;
}
