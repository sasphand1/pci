"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/fifi/router";
import { Check, Instagram, LayoutGrid, List, Plus, Scale, Search, UsersRound, X, Youtube } from "lucide-react";

import { EmptyState, Pagination, Pic } from "@/fifi/components/page-elements";
import { ComparePanel } from "@/fifi/pages/creators-compare";
import { cn } from "@/fifi/lib/utils";
import { formatCount } from "@/lib/format.mjs";
import { MAX_COMPARE, accountFollowers, asOfLabel, creatorsHref, toggleSlug } from "@/lib/creators.mjs";
import type { PubCreatorRow, PubCreatorTotals } from "@/lib/public";

export type CreatorsProps = {
  rows: PubCreatorRow[];
  total: number; pages: number; page: number;
  totals: PubCreatorTotals | null;
  search: string; category: string; platform: string; sort: string; view: string;
  categories: { slug: string; label: string }[];
  compare: string[]; open: boolean;
  compareRows: PubCreatorRow[];
};

const SORTS = [{ id: "rank", label: "Best ranked" }, { id: "followers", label: "Most followers" }, { id: "name", label: "Name A–Z" }];
const PLATFORMS = [{ id: "", label: "All" }, { id: "youtube", label: "YouTube" }, { id: "instagram", label: "Instagram" }];
const count = (n: number | null) => (n === null ? "Not available" : formatCount(String(n), true));

function Badges({ row }: { row: PubCreatorRow }) {
  const names = Array.from(new Set(row.accounts.map((a) => a.platform)));
  return <span className="flex gap-1">{names.map((p) => <span key={p} className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">{p === "youtube" ? "YT" : "IG"}</span>)}</span>;
}

function Followers({ row }: { row: PubCreatorRow }) {
  return (
    <div>
      <p className="text-sm font-bold leading-tight text-foreground">{count(row.totalFollowers)}</p>
      <p className={cn("text-[10px]", row.stale ? "text-gold-foreground" : "text-muted-foreground")}>{row.totalFollowers === null ? "no figure yet" : asOfLabel(row.asOf)}{row.stale ? " · older" : ""}</p>
    </div>
  );
}

function CompareToggle({ row, selected, full, onToggle }: { row: PubCreatorRow; selected: boolean; full: boolean; onToggle: (slug: string) => void }) {
  const blocked = full && !selected;
  return (
    <button type="button" onClick={() => onToggle(row.slug)} disabled={blocked} aria-pressed={selected}
      aria-label={selected ? `Remove ${row.displayName} from comparison` : `Add ${row.displayName} to comparison`}
      title={blocked ? `You can compare up to ${MAX_COMPARE} creators` : undefined}
      className={cn("inline-flex h-7 items-center justify-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
        selected ? "bg-primary text-primary-foreground" : "bg-secondary text-primary hover:bg-secondary/70")}>
      {selected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}{selected ? "Added" : "Compare"}
    </button>
  );
}

export function CreatorsPage(props: CreatorsProps) {
  const { rows, total, pages, page, totals, search, category, platform, sort, view, categories, compareRows } = props;
  const router = useRouter();
  const [query, setQuery] = useState(search);
  const [selected, setSelected] = useState<string[]>(props.compare);
  const [open, setOpen] = useState(props.open && props.compare.length >= 2);
  const [known, setKnown] = useState<Record<string, PubCreatorRow>>(() => Object.fromEntries([...rows, ...compareRows].map((r) => [r.slug, r])));
  const full = selected.length >= MAX_COMPARE;
  const state = { search, category, platform, sort, view, page };
  const go = (next: Partial<typeof state> & { compare?: string[]; open?: boolean }) =>
    router.push(creatorsHref({ ...state, page: 1, compare: selected, ...next }), { scroll: false });

  useEffect(() => { setKnown((k) => ({ ...k, ...Object.fromEntries(rows.map((r) => [r.slug, r])) })); }, [rows]);
  useEffect(() => {
    // Keep the address shareable without asking the server for the page again.
    window.history.replaceState(null, "", creatorsHref({ ...state, compare: selected, open }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, open]);

  const chosen = useMemo(() => selected.map((s) => known[s]).filter(Boolean) as PubCreatorRow[], [selected, known]);
  const onToggle = (slug: string) => setSelected((cur) => toggleSlug(cur, slug));
  const grid = view === "grid";
  const kpis = [
    { label: "Creators in the index", value: totals ? String(totals.creators) : "Not available", sub: "all categories", icon: UsersRound, tint: "bg-secondary text-primary" },
    { label: "On YouTube", value: totals ? String(totals.youtube) : "Not available", sub: "channels tracked", icon: Youtube, tint: "bg-gold-soft text-gold-foreground" },
    { label: "On Instagram", value: totals ? String(totals.instagram) : "Not available", sub: "accounts tracked", icon: Instagram, tint: "bg-gold-soft text-gold-foreground" },
    { label: "Compare side by side", value: `Up to ${MAX_COMPARE}`, sub: "pick creators below", icon: Scale, tint: "bg-secondary text-primary" },
  ];
  const tabs = [{ id: "", label: "All creators", icon: UsersRound }, { id: "youtube", label: "YouTube", icon: Youtube }, { id: "instagram", label: "Instagram", icon: Instagram }] as const;

  return (
    <main className="page-main pb-28 pt-5">
      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold-foreground"><UsersRound className="h-5 w-5" /></div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-primary sm:text-2xl">Creator Index</h1>
              <p className="text-xs text-muted-foreground">Search, filter and compare Pakistani creators. Every figure shows the date it was last updated.</p>
            </div>
          </div>
          <form className="relative w-full sm:w-72" onSubmit={(e) => { e.preventDefault(); go({ search: query.trim() }); }} role="search">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 w-full rounded-full border border-border bg-secondary/50 pl-9 pr-3 text-xs font-medium text-primary outline-none placeholder:text-muted-foreground focus:border-primary/40" placeholder="Search by name or handle…" aria-label="Search creators" />
          </form>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {kpis.map((item) => (
            <div key={item.label} className="rounded-xl border border-border/70 bg-background/60 p-3.5">
              <div className="flex items-start gap-2.5">
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", item.tint)}><item.icon className="h-4 w-4" /></span>
                <div className="min-w-0"><p className="truncate text-base font-bold leading-tight text-foreground">{item.value}</p><p className="truncate text-[10px] font-medium text-muted-foreground">{item.label}</p></div>
              </div>
              <p className="mt-2.5 truncate text-[10px] text-muted-foreground">{item.sub}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-border/70 bg-card p-5 shadow-soft" aria-label="Find creators">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80">
          <div className="flex gap-5" role="tablist" aria-label="Platform">
            {tabs.map((t) => (
              <button key={t.id || "all"} type="button" role="tab" aria-selected={platform === t.id} onClick={() => go({ platform: t.id })}
                className={cn("inline-flex items-center gap-1.5 border-b-2 pb-2.5 text-xs font-semibold transition", platform === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 pb-2.5">
            <select value={sort} onChange={(e) => go({ sort: e.target.value })} aria-label="Sort creators" className="h-8 rounded-full border border-border bg-secondary/50 px-3 text-xs font-semibold text-primary outline-none">{SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
            <div role="group" aria-label="Layout" className="inline-flex rounded-full border border-border bg-secondary/50 p-0.5">
              <button type="button" aria-pressed={!grid} aria-label="List view" onClick={() => go({ view: "list" })} className={cn("grid h-7 w-7 place-items-center rounded-full", !grid ? "bg-primary text-primary-foreground" : "text-muted-foreground")}><List className="h-3.5 w-3.5" /></button>
              <button type="button" aria-pressed={grid} aria-label="Grid view" onClick={() => go({ view: "grid" })} className={cn("grid h-7 w-7 place-items-center rounded-full", grid ? "bg-primary text-primary-foreground" : "text-muted-foreground")}><LayoutGrid className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {[{ slug: "", label: "All categories" }, ...categories].map((c) => (
            <button key={c.slug || "all"} type="button" onClick={() => go({ category: c.slug })}
              className={cn("h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition", category === c.slug ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary/50 text-primary hover:bg-secondary")}>{c.label}</button>
          ))}
        </div>

        <div className="mt-4" aria-live="polite">
          <h2 className="text-sm font-bold text-foreground">{platform === "youtube" ? "YouTube creators" : platform === "instagram" ? "Instagram creators" : "All creators"}</h2>
          <p className="text-[11px] text-muted-foreground"><span className="font-semibold text-foreground">{total}</span> {total === 1 ? "creator" : "creators"}{search ? <> matching “{search}”</> : null}, ordered by {SORTS.find((s) => s.id === sort)?.label.toLowerCase()}.</p>

          {rows.length === 0 ? <div className="mt-3"><EmptyState onReset={() => { setQuery(""); router.push("/creators"); }} /></div> : grid ? (
            <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
              {rows.map((r) => (
                <li key={r.slug} className={cn("overflow-hidden rounded-xl border border-border/70 bg-background/50 p-2.5", selected.includes(r.slug) && "ring-2 ring-primary")}>
                  <Link to="/creators/$id" params={{ id: r.slug }} className="relative block aspect-[3/2] overflow-hidden rounded-lg bg-muted sm:aspect-[4/3]">
                    <Pic src={r.avatarUrl} alt={r.displayName} className="h-full w-full object-cover transition duration-300 hover:scale-105" />
                    {r.rank !== null && <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-bold text-primary backdrop-blur">#{r.rank}</span>}
                  </Link>
                  <div className="mt-2.5">
                    <Link to="/creators/$id" params={{ id: r.slug }} className="block truncate text-xs font-bold text-foreground hover:text-primary">{r.displayName}</Link>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground"><Badges row={r} /><span className="truncate">{r.categories[0]?.label}</span></p>
                    <div className="mt-1.5"><Followers row={r} /></div>
                    <div className="mt-2.5 grid"><CompareToggle row={r} selected={selected.includes(r.slug)} full={full} onToggle={onToggle} /></div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-border/70">
              <div className="hidden grid-cols-[2.5rem_minmax(0,2.4fr)_5rem_minmax(0,1fr)_minmax(0,1fr)_6.5rem] items-center gap-4 border-b border-border/70 bg-secondary/40 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground md:grid">
                <span>Rank</span><span>Creator</span><span>Platforms</span><span>Followers</span><span>Est. monthly earnings</span><span className="sr-only">Compare</span>
              </div>
              <ul className="divide-y divide-border/70">
                {rows.map((r) => (
                  <li key={r.slug} className={cn("grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 bg-background/50 px-3 py-2.5 md:grid-cols-[2.5rem_minmax(0,2.4fr)_5rem_minmax(0,1fr)_minmax(0,1fr)_6.5rem] md:gap-4 md:px-4", selected.includes(r.slug) && "bg-secondary/60")}>
                    <span className="text-center text-sm font-bold text-primary">{r.rank ?? "—"}</span>
                    <Link to="/creators/$id" params={{ id: r.slug }} className="flex min-w-0 items-center gap-2.5">
                      <span className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-muted"><Pic src={r.avatarUrl} alt={r.displayName} className="h-full w-full object-cover" /></span>
                      <span className="min-w-0"><span className="block truncate text-xs font-bold text-foreground hover:text-primary">{r.displayName}</span><span className="block truncate text-[10px] text-muted-foreground">{r.categories.map((c) => c.label).join(" · ") || "Creator"}</span></span>
                    </Link>
                    <span className="hidden md:block"><Badges row={r} /></span>
                    <span className="hidden md:block"><Followers row={r} /></span>
                    <span className="hidden md:block">{r.earningsUsd === null ? <span className="text-[11px] text-muted-foreground">Not available</span> : <><span className="text-sm font-bold text-foreground">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(r.earningsUsd)}</span><span className="block text-[10px] text-muted-foreground">modeled estimate</span></>}</span>
                    <CompareToggle row={r} selected={selected.includes(r.slug)} full={full} onToggle={onToggle} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Pagination page={Math.min(page, pages)} pages={pages} onChange={(n) => go({ page: n })} />
          <p className="mt-5 text-[10px] leading-5 text-muted-foreground">Followers are each creator’s last recorded figures across their accounts, with the date shown. “Older” means the newest figure is more than 7 days old. Earnings are modeled estimates, not reported income. A missing figure is never shown as zero.</p>
        </div>
      </section>

      {chosen.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-3 sm:px-8" role="region" aria-label="Comparison tray">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card/95 px-4 py-3 shadow-lift backdrop-blur">
            <p className="flex items-center gap-2 text-xs font-bold text-primary"><Scale className="h-4 w-4" />{chosen.length} of {MAX_COMPARE}</p>
            <ul className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
              {chosen.map((c) => <li key={c.slug} className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-background/60 py-0.5 pl-0.5 pr-2 text-[11px] font-semibold text-primary"><span className="h-6 w-6 overflow-hidden rounded-full bg-muted"><Pic src={c.avatarUrl} alt={c.displayName} className="h-full w-full object-cover" /></span>{c.displayName}<button type="button" aria-label={`Remove ${c.displayName}`} onClick={() => onToggle(c.slug)} className="text-muted-foreground hover:text-primary"><X className="h-3 w-3" /></button></li>)}
            </ul>
            <button type="button" onClick={() => setSelected([])} className="text-[11px] font-semibold text-muted-foreground hover:text-primary">Clear</button>
            <button type="button" disabled={chosen.length < 2} onClick={() => setOpen(true)} className="h-8 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary-light disabled:opacity-40">{chosen.length < 2 ? "Pick one more" : "Compare now"}</button>
          </div>
        </div>
      )}

      {open && selected.length >= 2 && <ComparePanel slugs={selected} initial={compareRows} onClose={() => setOpen(false)} onRemove={onToggle} />}
    </main>
  );
}
