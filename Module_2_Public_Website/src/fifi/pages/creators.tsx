"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/fifi/router";
import { UsersRound } from "lucide-react";
import { PlatformIcon, InstagramIcon, YouTubeIcon, TikTokIcon } from "@/fifi/components/platform-icon";

import { EmptyState, Pagination, Pic } from "@/fifi/components/page-elements";
import { ChipRow, CompareToggle, HeadToHeadCard, KpiTile, OptionButtons, PANEL, PanelHeader, PillSelect, SearchBox, UnderlineTabs, ViewToggle } from "@/fifi/components/explorer-kit";
import { ComparePanel, firstPlatform, platOptions, type Plat } from "@/fifi/pages/creators-compare";
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
  return <span className="flex gap-1">{names.map((p) => <span key={p} className="grid h-5 w-5 place-items-center rounded-md bg-background ring-1 ring-border/70" title={p}><PlatformIcon platform={p} className="h-3.5 w-3.5" /></span>)}</span>;
}

function Followers({ row }: { row: PubCreatorRow }) {
  return (
    <div>
      <p className="text-sm font-bold leading-tight text-foreground">{count(row.totalFollowers)}</p>
      <p className={cn("text-[10px]", row.stale ? "text-gold-foreground" : "text-muted-foreground")}>{row.totalFollowers === null ? "no figure yet" : asOfLabel(row.asOf)}{row.stale ? " · older" : ""}</p>
    </div>
  );
}

export function CreatorsPage(props: CreatorsProps) {
  const { rows, total, pages, page, totals, search, category, platform, sort, view, categories, compareRows } = props;
  const router = useRouter();
  const [query, setQuery] = useState(search);
  const [selected, setSelected] = useState<string[]>(props.compare);
  const [plats, setPlats] = useState<Record<string, Plat>>({});
  const [open, setOpen] = useState(props.open && props.compare.length >= 2);
  const [known, setKnown] = useState<Record<string, PubCreatorRow>>(() => Object.fromEntries([...rows, ...compareRows].map((r) => [r.slug, r])));
  const full = selected.length >= MAX_COMPARE;
  const toEntity = (r: PubCreatorRow) => ({ key: r.slug, name: r.displayName, image: r.avatarUrl });
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
    { label: "Creators in the index", value: totals ? String(totals.creators) : "Not available", sub: "all categories", icon: UsersRound, },
    { label: "On YouTube", value: totals ? String(totals.youtube) : "Not available", sub: "channels tracked", icon: YouTubeIcon, plain: true },
    { label: "On Instagram", value: totals ? String(totals.instagram) : "Not available", sub: "accounts tracked", icon: InstagramIcon, plain: true }
  ];
  const tabs = [{ id: "", label: "All creators", icon: UsersRound }, { id: "youtube", label: "YouTube", icon: YouTubeIcon }, { id: "instagram", label: "Instagram", icon: InstagramIcon }, { id: "tiktok", label: "TikTok", icon: TikTokIcon }] as const;

  return (
    <main className="page-main pb-10 pt-5">
      <section className={PANEL}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <PanelHeader icon={UsersRound} title="Creator Index" subtitle="Search and filter Pakistani creators. Every figure shows the date it was last updated." />
            <SearchBox className="mt-4" value={query} onChange={setQuery} onSubmit={() => go({ search: query.trim() })} placeholder="Search by name or handle…" label="Search creators" />
            <div className="mt-4 grid grid-cols-3 gap-3">{kpis.map((item) => <KpiTile key={item.label} item={item} />)}</div>
          </div>
          <HeadToHeadCard subtitle="Pick two creators, then a platform for each" pool={Object.values(known).map(toEntity)} items={chosen.map(toEntity)}
            onPick={onToggle} onRemove={onToggle} onClear={() => setSelected([])} onCompare={() => setOpen(true)}
            slotExtra={(e) => { const c = known[e.key]; return <OptionButtons label={`Platform for ${c.displayName}`} value={plats[c.slug] ?? firstPlatform(c)} onChange={(id) => setPlats((m) => ({ ...m, [c.slug]: id as Plat }))} options={platOptions(c)} iconOnly />; }} />
        </div>
      </section>

      <section className={`mt-5 ${PANEL}`} aria-label="Find creators">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80">
          <UnderlineTabs label="Platform" tabs={tabs} value={platform} onChange={(id) => go({ platform: id })} />
          <div className="flex items-center gap-2 pb-2.5">
            <PillSelect label="Sort creators" value={sort} onChange={(v) => go({ sort: v })} options={SORTS} />
            <ViewToggle view={grid ? "grid" : "list"} onChange={(v) => go({ view: v })} />
          </div>
        </div>
        <ChipRow value={category} onChange={(id) => go({ category: id })} chips={[{ id: "", label: "All categories" }, ...categories.map((c) => ({ id: c.slug, label: c.label }))]} />

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
                    <div className="mt-2.5 grid"><CompareToggle name={r.displayName} limit={MAX_COMPARE} selected={selected.includes(r.slug)} full={full} onToggle={() => onToggle(r.slug)} /></div>
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
                    <CompareToggle name={r.displayName} limit={MAX_COMPARE} selected={selected.includes(r.slug)} full={full} onToggle={() => onToggle(r.slug)} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Pagination page={Math.min(page, pages)} pages={pages} onChange={(n) => go({ page: n })} />
          <p className="mt-5 text-[10px] leading-5 text-muted-foreground">Followers are each creator’s last recorded figures across their accounts, with the date shown. “Older” means the newest figure is more than 7 days old. Earnings are modeled estimates, not reported income. A missing figure is never shown as zero.</p>
        </div>
      </section>

      {open && selected.length >= 2 && <ComparePanel slugs={selected} plats={plats} onPlat={(slug, pl) => setPlats((m) => ({ ...m, [slug]: pl }))} initial={compareRows} onClose={() => setOpen(false)} />}
    </main>
  );
}
