"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/fifi/router";
import { LayoutGrid, List, Scale, Search, X, Check, Plus } from "lucide-react";

import { EmptyState, PageIntro, Pagination, Pic } from "@/fifi/components/page-elements";
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
  return <span className="flex gap-1">{names.map((p) => <span key={p} className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary-foreground">{p === "youtube" ? "YT" : "IG"}</span>)}</span>;
}

function Followers({ row }: { row: PubCreatorRow }) {
  return (
    <div>
      <p className="font-semibold text-foreground">{count(row.totalFollowers)}</p>
      <p className={cn("text-[11px]", row.stale ? "text-gold-foreground" : "text-muted-foreground")}>{row.totalFollowers === null ? "no figure yet" : asOfLabel(row.asOf)}{row.stale ? " · older" : ""}</p>
    </div>
  );
}

function CompareToggle({ row, selected, full, onToggle }: { row: PubCreatorRow; selected: boolean; full: boolean; onToggle: (slug: string) => void }) {
  const blocked = full && !selected;
  return (
    <button type="button" onClick={() => onToggle(row.slug)} disabled={blocked} aria-pressed={selected}
      aria-label={selected ? `Remove ${row.displayName} from comparison` : `Add ${row.displayName} to comparison`}
      title={blocked ? `You can compare up to ${MAX_COMPARE} creators` : undefined}
      className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
        selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-primary hover:bg-secondary")}>
      {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{selected ? "Added" : "Compare"}
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

  return (
    <main className="page-main pb-28">
      <PageIntro eyebrow="Creator Index" title="Pakistan's creators, ranked."
        description="Search every creator in the index, filter by platform and category, and put up to four side by side. Every figure shows the date it was last updated."
        aside={totals ? <dl className="grid grid-cols-3 gap-4 rounded-2xl border border-border bg-card px-5 py-4 text-center"><div><dt className="text-[11px] text-muted-foreground">Creators</dt><dd className="font-display text-2xl text-primary">{totals.creators}</dd></div><div><dt className="text-[11px] text-muted-foreground">On YouTube</dt><dd className="font-display text-2xl text-primary">{totals.youtube}</dd></div><div><dt className="text-[11px] text-muted-foreground">On Instagram</dt><dd className="font-display text-2xl text-primary">{totals.instagram}</dd></div></dl> : undefined} />

      <section className="sticky top-14 z-20 -mx-3 border-b border-border bg-background/92 px-3 py-4 backdrop-blur sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10" aria-label="Find creators">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") go({ search: query.trim() }); }}
              className="field w-full pl-11 pr-24" placeholder="Search by name or handle…" aria-label="Search creators" />
            <button type="button" onClick={() => go({ search: query.trim() })} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Search</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Platform" className="inline-flex rounded-full border border-border bg-card p-1">
              {PLATFORMS.map((p) => <button key={p.id || "all"} type="button" aria-pressed={platform === p.id} onClick={() => go({ platform: p.id })} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition", platform === p.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary")}>{p.label}</button>)}
            </div>
            <select value={sort} onChange={(e) => go({ sort: e.target.value })} className="field h-10 min-w-40" aria-label="Sort creators">{SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
            <div role="group" aria-label="Layout" className="inline-flex rounded-full border border-border bg-card p-1">
              <button type="button" aria-pressed={!grid} aria-label="List view" onClick={() => go({ view: "list" })} className={cn("grid h-8 w-8 place-items-center rounded-full", !grid ? "bg-primary text-primary-foreground" : "text-muted-foreground")}><List className="h-4 w-4" /></button>
              <button type="button" aria-pressed={grid} aria-label="Grid view" onClick={() => go({ view: "grid" })} className={cn("grid h-8 w-8 place-items-center rounded-full", grid ? "bg-primary text-primary-foreground" : "text-muted-foreground")}><LayoutGrid className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {[{ slug: "", label: "All categories" }, ...categories].map((c) => <button key={c.slug || "all"} type="button" onClick={() => go({ category: c.slug })} className={cn("filter-pill shrink-0", category === c.slug && "filter-pill-active")}>{c.label}</button>)}
        </div>
      </section>

      <section className="py-6" aria-live="polite">
        <p className="mb-4 text-sm text-muted-foreground"><span className="font-semibold text-foreground">{total}</span> {total === 1 ? "creator" : "creators"}{search ? <> matching “{search}”</> : null}</p>
        {rows.length === 0 ? <EmptyState onReset={() => { setQuery(""); router.push("/creators"); }} /> : grid ? (
          <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {rows.map((r) => (
              <li key={r.slug} className={cn("content-card overflow-hidden", selected.includes(r.slug) && "ring-2 ring-primary")}>
                <Link to="/creators/$id" params={{ id: r.slug }} className="block">
                  <div className="relative aspect-square overflow-hidden bg-muted"><Pic src={r.avatarUrl} alt={r.displayName} className="h-full w-full object-cover" />
                    {r.rank !== null && <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-bold text-primary backdrop-blur">#{r.rank}</span>}
                  </div>
                </Link>
                <div className="space-y-3 p-4">
                  <div><Link to="/creators/$id" params={{ id: r.slug }} className="font-display text-xl text-primary hover:underline">{r.displayName}</Link>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground"><Badges row={r} />{r.categories[0]?.label}</p></div>
                  <div className="flex items-end justify-between gap-2"><Followers row={r} /><CompareToggle row={r} selected={selected.includes(r.slug)} full={full} onToggle={onToggle} /></div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="content-card overflow-hidden">
            <div className="hidden grid-cols-[3rem_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-4 border-b border-border px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground md:grid">
              <span>Rank</span><span>Creator</span><span>Platforms</span><span>Followers</span><span>Est. monthly earnings</span><span className="sr-only">Compare</span>
            </div>
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.slug} className={cn("grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 md:grid-cols-[3rem_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:gap-4 md:px-5", selected.includes(r.slug) && "bg-secondary/60")}>
                  <span className="text-center font-display text-lg text-primary">{r.rank ?? "—"}</span>
                  <Link to="/creators/$id" params={{ id: r.slug }} className="flex min-w-0 items-center gap-3">
                    <span className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-muted"><Pic src={r.avatarUrl} alt={r.displayName} className="h-full w-full object-cover" /></span>
                    <span className="min-w-0"><span className="block truncate font-semibold text-primary hover:underline">{r.displayName}</span><span className="block truncate text-xs text-muted-foreground">{r.categories.map((c) => c.label).join(" · ") || "Creator"}</span></span>
                  </Link>
                  <span className="hidden md:block"><Badges row={r} /></span>
                  <span className="hidden md:block"><Followers row={r} /></span>
                  <span className="hidden text-sm md:block">{r.earningsUsd === null ? <span className="text-muted-foreground">Not available</span> : <>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(r.earningsUsd)}<span className="block text-[11px] text-muted-foreground">modeled estimate</span></>}</span>
                  <CompareToggle row={r} selected={selected.includes(r.slug)} full={full} onToggle={onToggle} />
                </li>
              ))}
            </ul>
          </div>
        )}
        <Pagination page={Math.min(page, pages)} pages={pages} onChange={(n) => go({ page: n })} />
        <p className="mt-6 text-xs leading-5 text-muted-foreground">Followers are each creator’s last recorded figures across their accounts, with the date shown. “Older” means the newest figure is more than 7 days old. Earnings are modeled estimates, not reported income. A missing figure is never shown as zero.</p>
      </section>

      {chosen.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-3 py-3 shadow-lift backdrop-blur sm:px-8" role="region" aria-label="Comparison tray">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-primary"><Scale className="h-4 w-4" />{chosen.length} of {MAX_COMPARE}</p>
            <ul className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
              {chosen.map((c) => <li key={c.slug} className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2 text-xs font-semibold text-primary"><span className="h-7 w-7 overflow-hidden rounded-full bg-muted"><Pic src={c.avatarUrl} alt={c.displayName} className="h-full w-full object-cover" /></span>{c.displayName}<button type="button" aria-label={`Remove ${c.displayName}`} onClick={() => onToggle(c.slug)} className="text-muted-foreground hover:text-primary"><X className="h-3.5 w-3.5" /></button></li>)}
            </ul>
            <button type="button" onClick={() => setSelected([])} className="text-xs font-semibold text-muted-foreground hover:text-primary">Clear</button>
            <button type="button" disabled={chosen.length < 2} onClick={() => setOpen(true)} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition disabled:opacity-40">{chosen.length < 2 ? "Pick one more" : "Compare now"}</button>
          </div>
        </div>
      )}

      {open && selected.length >= 2 && <ComparePanel slugs={selected} initial={compareRows} onClose={() => setOpen(false)} onRemove={onToggle} />}
    </main>
  );
}
