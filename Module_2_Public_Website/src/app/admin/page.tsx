import type {Metadata} from 'next';
import {FifiPage} from '@/fifi/FifiPage';
import {AdminPage} from '@/fifi/pages/admin';

export const metadata: Metadata = {
  title: 'Operations & Data Admin',
  description: 'Manage data pipelines, creator index verification, drama metrics and satellite feeds.',
  robots: {index: false, follow: false},
};

export default function Page() {
  return <FifiPage><AdminPage /></FifiPage>;
}
