"use client";

import { useMemo, useState } from "react";

import { BadgePercent, MapPin, Search, Star, Store } from "lucide-react";

import { EmptyState, PageIntro, SaveButton } from "@/fifi/components/page-elements";
import { businesses } from "@/fifi/lib/fifi-data";
import { cn } from "@/fifi/lib/utils";



const categories = ["All", ...Array.from(new Set(businesses.map((business) => business.category)))];

export function LocalPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [city, setCity] = useState("All cities");
  const filtered = useMemo(() => businesses.filter((business) => `${business.name} ${business.area} ${business.category}`.toLowerCase().includes(query.toLowerCase()) && (category === "All" || business.category === category) && (city === "All cities" || business.city === city)), [query, category, city]);
  function reset() { setQuery(""); setCategory("All"); setCity("All cities"); }

  return (
    <main className="page-main">
      <PageIntro eyebrow="Fifi around the corner" title="Local finds. Less guesswork." description="Independent places, practical services and neighbourhood favourites—useful details and genuine reasons to visit, all in one guide." aside={<div className="flex items-center gap-3 rounded-xl bg-gold-soft px-5 py-4 text-gold-foreground"><BadgePercent className="h-7 w-7" /><div><p className="text-sm font-bold">Local offers, clearly marked</p><p className="mt-1 text-xs">Preview offers for design demonstration</p></div></div>} />

      <section className="py-8" aria-label="Local business filters">
        <div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="field w-full pl-11" placeholder="Search cafés, shops, services or areas…" aria-label="Search local places" /></div><select value={city} onChange={(event) => setCity(event.target.value)} className="field min-w-44" aria-label="Filter places by city"><option>All cities</option>{Array.from(new Set(businesses.map((business) => business.city))).map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">{categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={cn("filter-pill shrink-0", category === item && "filter-pill-active")}>{item}</button>)}</div>
      </section>

      <section className="py-4" aria-live="polite">
        <div className="mb-6 flex items-end justify-between"><div><p className="eyebrow">The neighbourhood shortlist</p><h2 className="mt-2 font-display text-3xl text-primary">Selected for you</h2></div><p className="text-xs text-muted-foreground">{filtered.length} places</p></div>
        {filtered.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((business) => (
          <article key={business.id} className="content-card group overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-lift">
            <div className="relative aspect-[16/10] overflow-hidden bg-muted"><img src={business.image} alt={business.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute right-3 top-3"><SaveButton label={business.name} /></div><span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm"><MapPin className="h-3.5 w-3.5" />{business.city}</span></div>
            <div className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{business.category} · {business.area}</p><h3 className="mt-1 font-display text-2xl text-primary">{business.name}</h3></div><span className="flex items-center gap-1 rounded-md bg-gold-soft px-2 py-1 text-xs font-bold text-gold-foreground"><Star className="h-3 w-3 fill-gold text-gold" />{business.rating}</span></div><p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">{business.description}</p><div className="mt-5 rounded-lg bg-secondary/65 px-3 py-2.5 text-xs font-semibold text-secondary-foreground">{business.offer}</div><div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground"><span>{business.reviews} community ratings</span><span className="flex items-center gap-1"><Store className="h-3.5 w-3.5" />Independent</span></div></div>
          </article>
        ))}</div> : <EmptyState onReset={reset} />}
      </section>

      <section className="mt-10 overflow-hidden rounded-2xl bg-primary px-6 py-10 text-primary-foreground sm:px-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-soft">For local businesses</p><h2 className="mt-3 font-display text-3xl sm:text-4xl">Good places deserve to be found.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-primary-foreground/70">Fifi is building a more useful way for independent businesses to meet the right local audience.</p></div><a href="mailto:hello@fifi.pk?subject=List%20my%20business%20on%20Fifi" className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-gold px-6 text-sm font-bold text-primary transition hover:bg-gold-soft">List your business</a></div>
      </section>
    </main>
  );
}
