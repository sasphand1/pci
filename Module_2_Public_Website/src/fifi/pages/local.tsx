"use client";

import { useMemo, useState } from "react";
import { MapPin, Star, Store, ThumbsUp, Utensils } from "lucide-react";

import { CompareToggle, HeadToHeadCard, KpiTile, PANEL, PanelHeader, PillSelect, SearchBox, UnderlineTabs, ViewToggle, VsDialog, type Entity, type VsRow } from "@/fifi/components/explorer-kit";
import { EmptyState } from "@/fifi/components/page-elements";
import { cn } from "@/fifi/lib/utils";
import { formatCount } from "@/lib/format.mjs";
import { LOCAL_SORTS, MAX_LOCAL_COMPARE, asOfShort, filterPlaces, flattenPlaces, placeKey, splitPicks, type LocalPlace } from "@/lib/local.mjs";
import type { PubLocal } from "@/lib/public";

const reviews = (n: number | null) => (n === null ? "Not available" : formatCount(String(n), true));
const stars = (n: number) => n.toFixed(1);
const toEntity = (p: LocalPlace): Entity => ({ key: placeKey(p), name: p.name, sub: `${p.cityLabel}${p.area ? ` · ${p.area}` : ""}`, fallback: Utensils });

function RatingChip({ p }: { p: LocalPlace }) {
  return <span className="inline-flex items-center gap-1 rounded-md bg-gold-soft px-2 py-1 text-xs font-bold text-gold-foreground"><Star className="h-3 w-3 fill-gold text-gold" />{p.rating === null ? "—" : stars(p.rating)}</span>;
}
function Badge({ p }: { p: LocalPlace }) {
  if (p.pick) return <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-bold text-gold-foreground"><ThumbsUp className="h-3 w-3" />Our pick</span>;
  return <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-bold text-primary ring-1 ring-border/70">#{p.rank} in {p.cityLabel}</span>;
}
function Meta({ p }: { p: LocalPlace }) {
  return <p className="truncate text-[10px] text-muted-foreground">{p.cityLabel}{p.area ? ` · ${p.area}` : ""}</p>;
}
function Reviews({ p }: { p: LocalPlace }) {
  return <div><p className="text-sm font-bold leading-tight text-foreground">{reviews(p.reviewCount)}</p><p className="text-[10px] text-muted-foreground">Google reviews{p.asOf ? ` · ${asOfShort(p.asOf)}` : ""}</p></div>;
}
function MapLink({ p }: { p: LocalPlace }) {
  return p.mapsUrl ? <a href={p.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 items-center gap-1 rounded-lg bg-secondary px-2.5 text-[11px] font-semibold text-primary hover:bg-secondary/70"><MapPin className="h-3 w-3" />Map</a> : null;
}

export function LocalPage({ local }: { local: PubLocal | null }) {
  const cities = local?.data ?? [];
  const all = useMemo(() => flattenPlaces(cities), [cities]);
  const [city, setCity] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("rank");
  const [view, setView] = useState<"list" | "grid">("list");
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const shown = useMemo(() => filterPlaces(all, { city, query, sort }), [all, city, query, sort]);
  const { picks, ranked } = splitPicks(shown);
  const byKey = useMemo(() => new Map(all.map((p) => [placeKey(p), p])), [all]);
  const chosen = selected.map((k) => byKey.get(k)).filter(Boolean) as LocalPlace[];
  const full = selected.length >= MAX_LOCAL_COMPARE;
  const toggle = (k: string) => setSelected((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : cur.length >= MAX_LOCAL_COMPARE ? cur : [...cur, k]));
  const grid = view === "grid";

  const rated = all.filter((p) => p.rating !== null);
  const newest = all.map((p) => p.asOf).filter(Boolean).sort().pop() ?? null;
  const kpis = [
    { label: "Places listed", value: all.length ? String(all.length) : "Not available", sub: "ranked and picked", icon: Utensils },
    { label: "Cities", value: String(cities.filter((c) => c.places.length || c.picks.length).length || "Not available"), sub: "Karachi, Lahore, Islamabad", icon: MapPin, plain: true },
    { label: "Updated", value: asOfShort(newest) || "Not available", sub: rated.length ? `${rated.length} rated places` : "waiting for first collection", icon: Star, plain: true },
  ];
  const tabs = [{ id: "", label: "All cities" }, ...cities.map((c) => ({ id: c.slug, label: c.label }))];

  const rows = (a: LocalPlace, b: LocalPlace): VsRow[] => [
    { label: "Google rating", hint: "Out of 5", a: a.rating, b: b.rating, format: stars, max: 5 },
    { label: "Google reviews", hint: "More reviews make the rating more reliable", a: a.reviewCount, b: b.reviewCount, format: (n) => formatCount(String(n), true) },
  ];
  const side = (p: LocalPlace) => ({ name: p.name, href: p.mapsUrl ?? undefined, fallback: Utensils, sub: `${p.pick ? "Our pick" : `#${p.rank} in ${p.cityLabel}`}${p.area ? ` · ${p.area}` : ""}` });

  const card = (p: LocalPlace) => {
    const k = placeKey(p);
    return grid ? (
      <li key={k} className={cn("rounded-xl border border-border/70 bg-background/50 p-3", selected.includes(k) && "ring-2 ring-primary")}>
        <div className="flex items-start justify-between gap-2"><Badge p={p} /><RatingChip p={p} /></div>
        <h3 className="mt-2 truncate text-xs font-bold text-foreground">{p.name}</h3><Meta p={p} />
        <div className="mt-2"><Reviews p={p} /></div>
        {p.note && <p className="mt-2 rounded-lg bg-secondary/60 px-2 py-1.5 text-[10px] text-secondary-foreground">{p.note}</p>}
        <div className="mt-2.5 flex items-center gap-2"><CompareToggle name={p.name} limit={MAX_LOCAL_COMPARE} selected={selected.includes(k)} full={full} onToggle={() => toggle(k)} /><MapLink p={p} /></div>
      </li>
    ) : (
      <li key={k} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-background/50 px-3 py-2.5 md:grid-cols-[minmax(0,2.4fr)_4rem_minmax(0,1.2fr)_auto] md:gap-4 md:px-4", selected.includes(k) && "bg-secondary/60")}>
        <div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-xs font-bold text-foreground">{p.name}</span><Badge p={p} /></div><Meta p={p} />{p.note && <p className="mt-0.5 truncate text-[10px] text-secondary-foreground">{p.note}</p>}</div>
        <span className="hidden md:block"><RatingChip p={p} /></span>
        <span className="hidden md:block"><Reviews p={p} /></span>
        <div className="flex items-center gap-2"><MapLink p={p} /><CompareToggle name={p.name} limit={MAX_LOCAL_COMPARE} selected={selected.includes(k)} full={full} onToggle={() => toggle(k)} /></div>
      </li>
    );
  };
  const group = (title: string, items: LocalPlace[]) => items.length === 0 ? null : (
    <div className="mt-4"><h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {grid ? <ul className="mt-2 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">{items.map(card)}</ul>
        : <ul className="mt-2 divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70">{items.map(card)}</ul>}
    </div>
  );

  return (
    <main className="page-main pb-10 pt-5">
      <section className={PANEL}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <PanelHeader icon={Utensils} title="Restaurants" subtitle="Top-rated places in Karachi, Lahore and Islamabad, ranked from Google Maps ratings." />
            <SearchBox className="mt-4" value={query} onChange={setQuery} onSubmit={() => undefined} placeholder="Search by name or area…" label="Search restaurants" />
            <div className="mt-4 grid grid-cols-3 gap-3">{kpis.map((k) => <KpiTile key={k.label} item={k} />)}</div>
          </div>
          <HeadToHeadCard subtitle="Pick two restaurants to compare" pool={all.map(toEntity)} items={chosen.map(toEntity)}
            onPick={toggle} onRemove={toggle} onClear={() => setSelected([])} onCompare={() => setOpen(true)} />
        </div>
      </section>

      <section className={`mt-5 ${PANEL}`} aria-label="Find restaurants">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80">
          <UnderlineTabs label="City" tabs={tabs} value={city} onChange={setCity} />
          <div className="flex items-center gap-2 pb-2.5"><PillSelect label="Sort restaurants" value={sort} onChange={setSort} options={LOCAL_SORTS} /><ViewToggle view={view} onChange={setView} /></div>
        </div>

        <div className="mt-4" aria-live="polite">
          <h2 className="text-sm font-bold text-foreground">{city ? `${tabs.find((t) => t.id === city)?.label} restaurants` : "All restaurants"}</h2>
          <p className="text-[11px] text-muted-foreground"><span className="font-semibold text-foreground">{shown.length}</span> {shown.length === 1 ? "place" : "places"}{query ? <> matching “{query}”</> : null}, ordered by {LOCAL_SORTS.find((s) => s.id === sort)?.label.toLowerCase()}.</p>
          {all.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-border bg-background/60 px-6 py-12 text-center"><span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-background ring-1 ring-border/70"><Store className="h-5 w-5 text-primary" /></span><h3 className="mt-3 text-sm font-bold text-primary">Restaurant rankings are being prepared</h3><p className="mt-1 text-xs text-muted-foreground">The first collection from Google Maps has not run yet. Nothing is shown until real ratings are in.</p></div>
          ) : shown.length === 0 ? <div className="mt-3"><EmptyState onReset={() => { setQuery(""); setCity(""); }} /></div> : (
            <>
              {group("Our picks", picks)}
              {group("Top rated", ranked)}
            </>
          )}
          <p className="mt-5 text-[10px] leading-5 text-muted-foreground">{local?.attribution ?? "Ratings and review counts from Google Maps."} {local?.method ?? ""} Ratings are not shown for places last checked more than 30 days ago.</p>
        </div>
      </section>

      {open && chosen.length === 2 && <VsDialog ariaLabel="Compare restaurants" onClose={() => setOpen(false)} left={side(chosen[0])} right={side(chosen[1])} rows={rows(chosen[0], chosen[1])} footer="Ratings and review counts are Google Maps figures as of the date collected. A restaurant with more reviews has a more reliable rating. “Not available” means no figure was recorded." />}
    </main>
  );
}
