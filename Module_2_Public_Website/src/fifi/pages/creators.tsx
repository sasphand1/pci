"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/fifi/router";
import { BadgeCheck, Search, TrendingUp, UsersRound } from "lucide-react";

import { EmptyState, FollowButton, PageIntro, Pagination, SaveButton, Pic } from "@/fifi/components/page-elements";
import type { RealCreator } from "@/fifi/lib/real";
import { cn } from "@/fifi/lib/utils";



export type CreatorsProps = {
  creators: RealCreator[];
  total: number;
  pages: number;
  page: number;
  search: string;
  category: string; // category slug, "" for all
  categories: { slug: string; label: string }[];
};

export function CreatorsPage({ creators, total, pages, page, search, category, categories: categoryList }: CreatorsProps) {
  const router = useRouter();
  const [query, setQuery] = useState(search);
  const [city, setCity] = useState("All cities");
  const categories = [{ slug: "", label: "All" }, ...categoryList];
  const visible = useMemo(() => creators.filter((creator) => city === "All cities" || creator.city === city), [creators, city]);
  const filtered = { length: total };

  function go(next: { page?: number; search?: string; category?: string }) {
    const params = new URLSearchParams();
    const nextSearch = next.search ?? search;
    const nextCategory = next.category ?? category;
    const nextPage = next.page ?? 1;
    if (nextSearch) params.set("search", nextSearch);
    if (nextCategory) params.set("category", nextCategory);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    router.push(qs ? `/creators?${qs}` : "/creators");
  }
  const setPage = (value: number) => go({ page: value });
  function reset() { setQuery(""); setCity("All cities"); router.push("/creators"); }

  return (
    <main className="page-main">
      <PageIntro eyebrow="The Pakistan Creator Index" title="People worth paying attention to." description="A considered directory of Pakistani creators—organized by the quality of their ideas, the communities they build and the places they represent." aside={<div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-primary"><UsersRound className="h-5 w-5" /></span><div><p className="font-display text-2xl leading-none text-primary">12.4M</p><p className="mt-1 text-xs text-muted-foreground">Combined preview reach</p></div></div>} />

      <section className="py-8" aria-label="Creator filters">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") go({ search: query.trim(), page: 1 }); }} className="field w-full pl-11" placeholder="Search by name, handle or topic…" aria-label="Search creators" /></div>
          <select value={city} onChange={(event) => setCity(event.target.value)} className="field min-w-44" aria-label="Filter by city"><option>All cities</option>{Array.from(new Set(creators.map((creator) => creator.city))).map((item) => <option key={item}>{item}</option>)}</select>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">{categories.map((item) => <button key={item.slug || "all"} type="button" onClick={() => go({ category: item.slug, page: 1 })} className={cn("filter-pill shrink-0", category === item.slug && "filter-pill-active")}>{item.label}</button>)}</div>
      </section>

      <section className="pb-8" aria-live="polite">
        <div className="mb-5 flex items-center justify-between text-sm"><p className="text-muted-foreground"><span className="font-semibold text-foreground">{filtered.length}</span> creators found</p><p className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"><TrendingUp className="h-4 w-4 text-gold" /> Ordered by editorial relevance</p></div>
        {visible.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((creator) => (
            <article key={creator.id} className="content-card group overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-lift">
              <div className="relative aspect-[4/3] overflow-hidden bg-muted"><Pic src={creator.image} alt={creator.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute right-3 top-3"><SaveButton label={creator.name} /></div><span className="absolute bottom-3 left-3 rounded-full bg-background/90 px-3 py-1.5 text-xs font-semibold text-primary backdrop-blur">{creator.city}</span></div>
              <div className="p-5"><div className="flex items-start justify-between gap-3"><div><Link to="/creators/$id" params={{ id: creator.slug ?? String(creator.id) }} className="group inline-flex items-center gap-1.5 font-display text-2xl text-primary hover:underline">{creator.name}<BadgeCheck className="h-4 w-4 fill-primary text-primary-foreground" /></Link><p className="mt-1 text-xs text-muted-foreground">{creator.handle} · {creator.category}</p></div><span className="rounded-md bg-secondary px-2 py-1 text-xs font-bold text-secondary-foreground">{creator.growth}</span></div><p className="mt-4 min-h-12 text-sm leading-6 text-muted-foreground">{creator.bio}</p><div className="mt-5 flex items-center justify-between border-t border-border pt-4"><div><p className="font-semibold text-foreground">{creator.followers}</p><p className="text-[11px] text-muted-foreground">followers</p></div><div className="flex items-center gap-2"><Link to="/creators/$id" params={{ id: creator.slug ?? String(creator.id) }} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-secondary">Profile</Link><FollowButton name={creator.name} /></div></div></div>
            </article>
          ))}
        </div> : <EmptyState onReset={reset} />}
        <Pagination page={Math.min(page, pages)} pages={pages} onChange={setPage} />
      </section>
    </main>
  );
}
