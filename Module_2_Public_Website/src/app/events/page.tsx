import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: 'Events Radar — Karachi, Lahore & Islamabad',
  description: 'Explore PCI events by city and category on an interactive map. Only verified, approved event announcements are displayed.',
};

export default function EventsPage() {
  return (
    <section className="pci-events-host" aria-label="PCI interactive events map">
      <iframe
        className="pci-events-frame"
        title="PCI Events Radar — interactive map, city and category filters"
        src="/events-radar.html"
        loading="eager"
        allow="geolocation"
      />
    </section>
  );
}
