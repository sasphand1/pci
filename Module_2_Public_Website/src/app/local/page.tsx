import type {Metadata} from 'next';
import {FifiPage} from '@/fifi/FifiPage';
import {LocalPage} from '@/fifi/pages/local';

export const metadata: Metadata = {
  title: 'Local Pakistan Guide — Fifi',
  description: 'Discover independent Pakistani businesses, neighbourhood favourites and useful local offers.',
};

export default function Page() {
  return <FifiPage><LocalPage /></FifiPage>;
}
