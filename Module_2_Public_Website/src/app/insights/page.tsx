import type {Metadata} from 'next';
import {FifiPage} from '@/fifi/FifiPage';
import {InsightsPage} from '@/fifi/pages/insights';

export const metadata: Metadata = {
  title: 'Insights & The Fifi Journal — Fifi',
  description: "Source-aware stories and practical explanations behind Pakistan's digital and local trends.",
};

export default function Page() {
  return <FifiPage><InsightsPage /></FifiPage>;
}
