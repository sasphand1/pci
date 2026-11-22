"use client";

import { useMemo, useState } from "react";

import { ArrowUpRight, CalendarDays, Clock3, MapPin, Search, Share2, Ticket } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, PageIntro, Pagination, SaveButton, Pic } from "@/fifi/components/page-elements";
import type { EventItem } from "@/fifi/lib/fifi-data";
import { cn } from "@/fifi/lib/utils";



export function EventsPage({ events }: { events: EventItem[] }) {
  const categories = useMemo(() => ["All", ...Array.from(new Set(events.map((event) => event.category)))], [events]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [city, setCity] = useState("All cities");
  const [page, setPage] = useState(1);
  const perPage = 6;
  const filtered = useMemo(() => events.filter((event) => `${event.title} ${event.venue} ${event.category}`.toLowerCase().includes(query.toLowerCase()) && (category === "All" || event.category === category) && (city === "All cities" || event.city === city)), [query, category, city]);
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);
  const featured = events[0];
  function reset() { setQuery(""); setCategory("All"); setCity("All cities"); setPage(1); }

  return (
    <main className="page-main">
      <PageIntro eyebrow="The Fifi city calendar" title="Make plans worth keeping." description="Festivals, performances, talks and small gatherings across Pakistan—edited into a calendar that's actually easy to browse." aside={<div className="rounded-xl border border-border bg-card px-5 py-4"><p className="text-xs font-semibold uppercase tracking-wider text-gold-foreground">This week's pick</p><p className="mt-1 font-display text-xl text-primary">Karachi Food Festival</p><p className="mt-1 text-xs text-muted-foreground">Saturday · Beach Luxury Hotel</p></div>} />

      {featured && <section className="py-8">
        <article className="group relative min-h-[360px] overflow-hidden rounded-2xl bg-primary shadow-lift">
          <Pic src={featured.image} alt={featured.title} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/95 via-primary/65 to-primary/10" />
          <div className="relative flex min-h-[360px] max-w-2xl flex-col justify-end p-6 text-primary-foreground sm:p-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-soft">Next up · {featured.city}</p>
            <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">{featured.title}</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-primary-foreground/80">{featured.description}</p>
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-primary-foreground/80"><span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{featured.dateLabel}</span><span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{featured.venue}</span><span className="flex items-center gap-1.5"><Ticket className="h-4 w-4" />{featured.price}</span></div>
          </div>
        </article>
      </section>}

      <section className="border-y border-border py-6" aria-label="Event filters">
        <div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className="field w-full pl-11" placeholder="Search events or venues…" aria-label="Search events" /></div><select value={city} onChange={(event) => { setCity(event.target.value); setPage(1); }} className="field min-w-44" aria-label="Filter events by city"><option>All cities</option>{Array.from(new Set(events.map((event) => event.city))).map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">{categories.map((item) => <button key={item} type="button" onClick={() => { setCategory(item); setPage(1); }} className={cn("filter-pill shrink-0", category === item && "filter-pill-active")}>{item}</button>)}</div>
      </section>

      <section className="py-8" aria-live="polite">
        <div className="mb-5 flex items-center justify-between"><h2 className="font-display text-3xl text-primary">Upcoming in Pakistan</h2><span className="text-xs text-muted-foreground">{filtered.length} events</span></div>
        {visible.length ? <div className="grid gap-5 md:grid-cols-2">{visible.map((event) => (
          <article key={event.id} className="content-card group flex min-h-56 overflow-hidden transition hover:shadow-lift">
            <div className="relative hidden w-40 shrink-0 overflow-hidden sm:block"><Pic src={event.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /></div>
            <div className="flex min-w-0 flex-1 gap-4 p-5"><div className="flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-gold-soft text-gold-foreground"><span className="font-display text-2xl leading-none">{event.day}</span><span className="mt-1 text-[10px] font-bold tracking-widest">{event.month}</span></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><p className="text-[11px] font-bold uppercase tracking-wider text-gold-foreground">{event.category}</p><h3 className="mt-1 font-display text-2xl leading-tight text-primary">{event.title}</h3></div><div className="flex items-center gap-1.5"><button type="button" onClick={() => { const text = `${event.title} — ${event.dateLabel} at ${event.venue}, ${event.city} (${event.price})`; navigator.clipboard?.writeText(text); toast.success(`Copied shareable card for ${event.title}`); }} aria-label={`Share ${event.title}`} className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background text-muted-foreground transition hover:border-primary/35 hover:text-primary"><Share2 className="h-4 w-4" /></button><SaveButton label={event.title} /></div></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{event.description}</p><div className="mt-4 space-y-1.5 text-xs text-muted-foreground"><p className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-primary" />{event.dateLabel}</p><p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary" />{event.venue}, {event.city}</p></div><p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">{event.price}<ArrowUpRight className="h-3.5 w-3.5" /></p></div></div>
          </article>
        ))}</div> : <EmptyState onReset={reset} />}
        <Pagination page={currentPage} pages={pages} onChange={setPage} />
      </section>
    </main>
  );
}
