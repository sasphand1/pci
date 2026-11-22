"use client";

import { useState } from "react";
import { Link } from "@/fifi/router";
import { ArrowRight, BadgeCheck, BarChart3, Building2, CalendarDays, Flame, MapPin, Star, UsersRound } from "lucide-react";

import { FifiAssistant } from "@/fifi/components/fifi-assistant";
import { SaveButton, Pic } from "@/fifi/components/page-elements";
import { PulseSlideshow } from "@/fifi/components/pulse-slideshow";
import { businesses, type EventItem } from "@/fifi/lib/fifi-data";
import type { RealCreator } from "@/fifi/lib/real";
import { cn } from "@/fifi/lib/utils";



export type CategoryRow = { slug: string; label: string; creators: RealCreator[] };
export type HomeProps = {
  creators: RealCreator[];
  events: EventItem[];
  categoryRows: CategoryRow[];
  reach: string | null; // sum of published ranks, or null when it cannot be stated honestly
  eventsCount: number | null;
};

export function HomePage({ creators, events, categoryRows, reach, eventsCount }: HomeProps) {
  const kpis = [
    { label: "Creator Reach", value: reach ?? "Not available", delta: "Live", sub: "published ranking", icon: UsersRound, tint: "bg-secondary text-primary" },
    // Sample content from the design: no local-business source exists yet.
    { label: "New Local Businesses", value: "3.2K", delta: "↑ +12%", sub: "vs. last week", icon: Building2, tint: "bg-gold-soft text-gold-foreground" },
    { label: "Upcoming Events", value: eventsCount === null ? "Not available" : String(eventsCount), delta: "Live", sub: "published events", icon: CalendarDays, tint: "bg-gold-soft text-gold-foreground" },
    // Sample content from the design: no trend source exists yet.
    { label: "Top Trend in Pakistan", value: "#LahoreEats", delta: "↑ +145%", sub: "in conversations", icon: Flame, tint: "bg-gold-soft text-gold-foreground" },
  ];
  const [region, setRegion] = useState("All Pakistan");
  const [tab, setTab] = useState<"creators" | "businesses" | "events">("creators");
  const [followed, setFollowed] = useState<Record<number, boolean>>({});

  return (
    <main className="page-main pb-10 pt-5">
      <div className="grid gap-5 lg:grid-cols-[1.58fr_1fr] lg:items-start">
        <div className="space-y-5">
          <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold-foreground">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-primary sm:text-2xl">Daily Pakistan Pulse</h1>
                  <p className="text-xs text-muted-foreground">Real trends. Real people. A smarter Pakistan.</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="hidden text-[11px] text-muted-foreground sm:inline">Sunday, 22 Nov 2026</span>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  aria-label="Filter region"
                  className="h-8 rounded-full border border-border bg-secondary/50 px-3 text-xs font-semibold text-primary outline-none"
                >
                  <option>All Pakistan</option>
                  <option>Lahore</option>
                  <option>Karachi</option>
                  <option>Islamabad</option>
                </select>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
              {kpis.map((item) => (
                <div key={item.label} className="rounded-xl border border-border/70 bg-background/60 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", item.tint)}>
                      <item.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold leading-tight text-foreground">{item.value}</p>
                      <p className="truncate text-[10px] font-medium text-muted-foreground">{item.label}</p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-1.5">
                    <span className="text-[11px] font-bold text-primary">{item.delta}</span>
                    <span className="truncate text-[10px] text-muted-foreground">{item.sub}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <PulseSlideshow />
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80">
              <div className="flex gap-5" role="tablist">
                {(
                  [
                    ["creators", "Creators", UsersRound],
                    ["businesses", "Local Businesses", Building2],
                    ["events", "Upcoming Events", CalendarDays],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 border-b-2 pb-2.5 text-xs font-semibold transition",
                      tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" /> {label}
                  </button>
                ))}
              </div>
              <Link
                to={tab === "creators" ? "/creators" : tab === "businesses" ? "/local" : "/events"}
                className="inline-flex items-center gap-1 pb-2.5 text-xs font-semibold text-primary hover:underline"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {tab === "creators" && (
              <div className="mt-4">
                <h2 className="text-sm font-bold text-foreground">Top Creators in Pakistan</h2>
                <p className="text-[11px] text-muted-foreground">Verified Pakistani creators ranked by audience reach and engagement.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {creators.slice(0, 4).map((creator) => {
                    const isFollowing = Boolean(followed[creator.id]);
                    return (
                      <article key={creator.id} className="overflow-hidden rounded-xl border border-border/70 bg-background/50 p-2.5">
                        <Link to="/creators/$id" params={{ id: creator.slug ?? String(creator.id) }} className="block aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                          <Pic src={creator.image} alt={creator.name} className="h-full w-full object-cover transition duration-300 hover:scale-105" />
                        </Link>
                        <div className="mt-2.5">
                          <Link to="/creators/$id" params={{ id: creator.slug ?? String(creator.id) }} className="inline-flex items-center gap-1 text-xs font-bold text-foreground hover:text-primary">
                            <span className="truncate">{creator.name}</span>
                            <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-primary text-primary-foreground" />
                          </Link>
                          <p className="text-[10px] text-muted-foreground">{creator.category}</p>
                          <p className="mt-1 text-[10px] font-semibold text-foreground/80">{creator.followers} followers</p>
                          <button
                            type="button"
                            onClick={() => setFollowed((prev) => ({ ...prev, [creator.id]: !prev[creator.id] }))}
                            className={cn(
                              "mt-2.5 h-7 w-full rounded-lg text-[11px] font-semibold transition",
                              isFollowing ? "bg-secondary text-primary" : "bg-primary text-primary-foreground hover:bg-primary-light",
                            )}
                          >
                            {isFollowing ? "Following" : "Follow"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === "events" && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {events.slice(0, 4).map((ev) => (
                  <Link key={ev.id} to="/events" className="group overflow-hidden rounded-xl border border-border/70 bg-background/50 p-2.5">
                    <div className="aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                      <Pic src={ev.image} alt={ev.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                    </div>
                    <p className="mt-2 text-[10px] font-bold uppercase text-gold-foreground">{ev.day} {ev.month} · {ev.city}</p>
                    <p className="mt-0.5 truncate text-xs font-bold text-foreground group-hover:text-primary">{ev.title}</p>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" /> {ev.venue}</p>
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-6 border-t border-border/70 pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-foreground">Featured Local Businesses in {region === "All Pakistan" ? "Lahore" : region}</h2>
                  <p className="text-[11px] text-muted-foreground">Support local. Find verified places and offers.</p>
                </div>
                <Link to="/local" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {businesses.slice(0, 4).map((biz) => (
                  <article key={biz.id} className="overflow-hidden rounded-xl border border-border/70 bg-background/50">
                    <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                      <img src={biz.image} alt={biz.name} className="h-full w-full object-cover" />
                      <div className="absolute right-2 top-2 scale-75"><SaveButton label={biz.name} /></div>
                    </div>
                    <div className="p-2.5">
                      <p className="flex items-center gap-1 truncate text-xs font-bold text-foreground">
                        {biz.name}
                        <BadgeCheck className="h-3 w-3 shrink-0 fill-primary text-primary-foreground" />
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">{biz.category} · {biz.area}</p>
                      <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-gold-foreground">
                        <Star className="h-2.5 w-2.5 fill-gold text-gold" /> {biz.rating}
                      </p>
                      <span className="mt-2 inline-block rounded-md bg-gold-soft px-2 py-0.5 text-[9px] font-bold uppercase text-gold-foreground">
                        {biz.offer}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {categoryRows.map((row) => {
            const filler = Math.max(0, 4 - row.creators.length);
            return (
              <section key={row.slug} className="rounded-2xl border border-border/70 bg-card p-5 shadow-soft" aria-label={`${row.label} creators`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-foreground">Top in {row.label}</h2>
                    <p className="text-[11px] text-muted-foreground">Ranked from the latest published snapshot.</p>
                  </div>
                  <Link to="/creators" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    View all <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {row.creators.slice(0, 4).map((creator) => (
                    <article key={creator.slug} className="overflow-hidden rounded-xl border border-border/70 bg-background/50 p-2.5">
                      <Link to="/creators/$id" params={{ id: creator.slug }} className="block aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                        <Pic src={creator.image} alt={creator.name} className="h-full w-full object-cover transition duration-300 hover:scale-105" />
                      </Link>
                      <div className="mt-2.5">
                        <Link to="/creators/$id" params={{ id: creator.slug }} className="inline-flex items-center gap-1 text-xs font-bold text-foreground hover:text-primary">
                          <span className="truncate">{creator.name}</span>
                          <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-primary text-primary-foreground" />
                        </Link>
                        <p className="text-[10px] text-muted-foreground">{creator.category}</p>
                        <p className="mt-1 text-[10px] font-semibold text-foreground/80">{creator.followers} followers</p>
                      </div>
                    </article>
                  ))}
                  {Array.from({ length: filler }, (_, index) => (
                    <article key={`ph-${index}`} className="overflow-hidden rounded-xl border border-dashed border-border/70 bg-background/30 p-2.5" aria-hidden="true">
                      <div className="aspect-[4/3] overflow-hidden rounded-lg"><Pic src="" alt="Creator" /></div>
                      <div className="mt-2.5">
                        <p className="text-xs font-bold text-foreground/60">Creator name</p>
                        <p className="text-[10px] text-muted-foreground">{row.label}</p>
                        <p className="mt-1 text-[10px] font-semibold text-foreground/50">— followers</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <aside className="lg:sticky lg:top-20">
          <FifiAssistant />
        </aside>
      </div>
    </main>
  );
}