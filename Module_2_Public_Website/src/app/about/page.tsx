import type {Metadata} from 'next';
import {FifiPage} from '@/fifi/FifiPage';
import {AboutPage} from '@/fifi/pages/about';

export const metadata: Metadata = {
  title: 'About Fifi — A Clearer View of Pakistan',
  description: 'Meet Fifi: a Pakistani information and discovery platform built around useful context, community and local opportunity.',
};

export default function Page() {
  return <FifiPage><AboutPage /></FifiPage>;
}
