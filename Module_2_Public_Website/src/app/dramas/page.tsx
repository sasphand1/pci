import type {Metadata} from 'next';
import {FifiPage} from '@/fifi/FifiPage';
import {DramasPage} from '@/fifi/pages/dramas';

export const metadata: Metadata = {
  title: 'Top Dramas & Comparison — Fifi',
  description: "Track Pakistan's top dramas this week and this month, and compare any two shows side by side.",
};

export default function Page() {
  return <FifiPage><DramasPage /></FifiPage>;
}
