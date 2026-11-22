import type {Metadata} from 'next';
import {adapterGet} from '@/lib/api';
import {normalizePublicEvents} from '@/lib/event-table.mjs';
import {FifiPage} from '@/fifi/FifiPage';
import {EventsPage} from '@/fifi/pages/events';
import {eventRowToItem} from '@/fifi/lib/real';

export const metadata: Metadata = {
  title: 'Events & Things To Do — Fifi',
  description: 'A concise, city-by-city guide to Pakistan\'s cultural, food, music, business and community events. Only verified, approved event announcements are displayed.',
};

export default async function Events() {
  const res = await adapterGet<{data: unknown}>('/api/v1/public/events');
  const rows = res && Array.isArray(res.data) ? normalizePublicEvents(res.data) : [];
  return (
    <>
      <FifiPage><EventsPage events={rows.map((e,i)=>eventRowToItem(e,i))} /></FifiPage>
      <FifiPage>
        <div className="page-main pb-10">
          <section className="mt-2 h-[min(70vh,560px)] overflow-hidden rounded-2xl border border-border bg-card shadow-soft" aria-label="Interactive events map">
            <iframe
              className="pci-events-frame h-full w-full border-0"
              title="Events Radar — interactive map, city and category filters"
              src="/events-radar.html"
              loading="lazy"
              allow="geolocation"
            />
          </section>
        </div>
      </FifiPage>
    </>
  );
}
