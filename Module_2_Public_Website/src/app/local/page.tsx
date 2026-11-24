import type {Metadata} from 'next';
import {pubLocal} from '@/lib/public';
import {FifiPage} from '@/fifi/FifiPage';
import {LocalPage} from '@/fifi/pages/local';

export const metadata: Metadata = {
  title: 'Restaurants — Pakistan Creator Index',
  description: 'Top-rated restaurants in Karachi, Lahore and Islamabad, ranked from Google Maps ratings, with head-to-head comparison.',
};

export default async function Page() {
  const local = await pubLocal();
  return <FifiPage><LocalPage local={local} /></FifiPage>;
}
