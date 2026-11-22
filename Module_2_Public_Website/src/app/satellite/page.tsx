import type {Metadata} from 'next';
import {FifiPage} from '@/fifi/FifiPage';
import {PageIntro} from '@/fifi/components/page-elements';
import {adapterGet} from '@/lib/api';
import {SatelliteDashboard} from '@/components/SatelliteDashboard';
export const metadata:Metadata={title:'Pakistan Satellite Intelligence',description:'Satellite-derived fire hotspots, rainfall and solar-resource estimates for Pakistan. Sources, observation times and limitations are shown.'};
export default async function SatellitePage(){const [sources,fires,rain,solar]=await Promise.all([
 adapterGet<{data:unknown[]}>('/api/v1/satellite/sources'),
 adapterGet<{data:unknown[]}>('/api/v1/satellite/fires/latest?limit=100'),
 adapterGet<{data:unknown[]}>('/api/v1/satellite/rainfall/latest?city=lahore'),
 adapterGet<{data:unknown[]}>('/api/v1/satellite/solar/latest?city=lahore')
]);return <FifiPage><main className="page-main pb-10"><PageIntro eyebrow="Pakistan from space" title="Satellite Intelligence" description="Open Earth-observation data, processed into verifiable public indicators. Not a safety warning or emergency service."/><div className="container satellite-page mt-8"><SatelliteDashboard sources={sources?.data??[]} fires={fires?.data??[]} rain={rain?.data??[]} solar={solar?.data??[]}/></div></main></FifiPage>;}
