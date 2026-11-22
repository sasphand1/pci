"use client";

import { useEffect, useState } from "react";
import { Link } from "@/fifi/router";
import { ArrowRight, ChevronLeft, ChevronRight, Flame, Instagram, MapPin, TrendingUp, Tv, UsersRound, Youtube } from "lucide-react";

import { creators, events } from "@/fifi/lib/fifi-data";
import { dramas } from "@/fifi/lib/fifi-extras";
import { cn } from "@/fifi/lib/utils";

/** How long a slide holds still before swishing left again. */
export const SLIDE_DWELL_MS = 4000;
/** Duration of the left swish itself. */
const SWISH_MS = 620;

const trendingTopics = [
  { tag: "#LahoreEats", lift: "145%" },
  { tag: "#PSL2026", lift: "92%" },
  { tag: "#TravelPakistan", lift: "68%" },
  { tag: "#PakistaniCreators", lift: "54%" },
  { tag: "#IslamabadDiaries", lift: "39%" },
];

const cityShare = [
  { city: "Lahore", pct: 42 },
  { city: "Karachi", pct: 28 },
  { city: "Islamabad", pct: 18 },
  { city: "Others", pct: 12 },
];

const topCategories = [
  { name: "Food & Dining", pct: "34%" },
  { name: "Travel & Places", pct: "22%" },
  { name: "Lifestyle", pct: "18%" },
  { name: "Sports", pct: "14%" },
  { name: "Tech & Gadgets", pct: "12%" },
];

const slides = [
  { id: "overview", label: "Pulse", to: "/insights" as const, linkText: "Full insights" },
  { id: "dramas", label: "Top Dramas", to: "/dramas" as const, linkText: "Compare dramas" },
  { id: "events", label: "Top Events", to: "/events" as const, linkText: "All metro events" },
  { id: "creators", label: "Top Creators", to: "/creators" as const, linkText: "Creator index" },
  { id: "youtubers", label: "YouTubers", to: "/creators" as const, linkText: "All YouTubers" },
  { id: "instagrammers", label: "Instagrammers", to: "/creators" as const, linkText: "All Instagrammers" },
];

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="w-full shrink-0">{children}</div>;
}

function renderPanel(id: string) {
  if (id === "overview") {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-background/60 p-3.5">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Flame className="h-3.5 w-3.5 text-gold" /> Trending Topics
          </h3>
          <ul className="mt-2.5 space-y-2">
            {trendingTopics.map((item, i) => (
              <li key={item.tag} className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-gold-soft text-[9px] font-bold text-gold-foreground">{i + 1}</span>
                  {item.tag}
                </span>
                <span className="font-semibold text-primary">▲ {item.lift}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/60 p-3.5">
          <h3 className="text-xs font-bold text-foreground">Conversation by City</h3>
          <div className="mt-3 space-y-2.5">
            {cityShare.map((row) => (
              <div key={row.city} className="grid grid-cols-[62px_30px_1fr] items-center gap-2 text-[11px]">
                <span className="font-medium text-muted-foreground">{row.city}</span>
                <span className="font-bold text-foreground">{row.pct}%</span>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${row.pct * 2.1}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-background/60 p-3.5">
          <h3 className="text-xs font-bold text-foreground">Top Categories</h3>
          <ul className="mt-2.5 space-y-2">
            {topCategories.map((cat) => (
              <li key={cat.name} className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-foreground">{cat.name}</span>
                <span className="font-bold text-primary">{cat.pct}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (id === "dramas") {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {dramas.slice(0, 3).map((drama, i) => (
          <Link key={drama.id} to="/dramas" className="rounded-xl border border-border/70 bg-background/60 p-3.5 transition hover:border-primary/40">
            <div className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1 font-bold text-primary"><Tv className="h-3.5 w-3.5" /> #{i + 1} · {drama.network}</span>
              <span className="font-semibold text-gold-foreground">{drama.weeklyChange}</span>
            </div>
            <p className="mt-2 text-sm font-bold text-foreground">{drama.title}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{drama.weeklyViewsM}M weekly views · TRP {drama.trp}</p>
          </Link>
        ))}
      </div>
    );
  }

  if (id === "events") {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {events.slice(0, 3).map((event) => (
          <Link key={event.id} to="/events" className="rounded-xl border border-border/70 bg-background/60 p-3.5 transition hover:border-primary/40">
            <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-bold uppercase text-gold-foreground">{event.day} {event.month} · {event.city}</span>
            <p className="mt-2 text-sm font-bold text-foreground">{event.title}</p>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><MapPin className="h-3 w-3" /> {event.venue}</p>
          </Link>
        ))}
      </div>
    );
  }

  if (id === "creators") {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {creators.slice(0, 3).map((creator, i) => (
          <Link key={creator.id} to="/creators/$id" params={{ id: String(creator.id) }} className="rounded-xl border border-border/70 bg-background/60 p-3.5 transition hover:border-primary/40">
            <div className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1 font-bold text-primary"><UsersRound className="h-3.5 w-3.5" /> #{i + 1} · {creator.category}</span>
              <span className="inline-flex items-center gap-0.5 font-semibold text-gold-foreground"><TrendingUp className="h-3 w-3" /> {creator.growth}</span>
            </div>
            <p className="mt-2 text-sm font-bold text-foreground">{creator.name}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{creator.followers} followers · {creator.city}</p>
          </Link>
        ))}
      </div>
    );
  }

  if (id === "youtubers") {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {[creators[1]!, creators[5]!, creators[7]!].map((creator, i) => (
          <Link key={creator.id} to="/creators/$id" params={{ id: String(creator.id) }} className="rounded-xl border border-border/70 bg-background/60 p-3.5 transition hover:border-primary/40">
            <div className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1 font-bold text-primary"><Youtube className="h-3.5 w-3.5" /> #{i + 1} YouTube</span>
              <span className="font-semibold text-gold-foreground">{creator.growth}</span>
            </div>
            <p className="mt-2 text-sm font-bold text-foreground">{creator.name}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{creator.followers} subscribers · {creator.city}</p>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {[creators[0]!, creators[2]!, creators[4]!].map((creator, i) => (
        <Link key={creator.id} to="/creators/$id" params={{ id: String(creator.id) }} className="rounded-xl border border-border/70 bg-background/60 p-3.5 transition hover:border-primary/40">
          <div className="flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1 font-bold text-primary"><Instagram className="h-3.5 w-3.5" /> #{i + 1} Instagram</span>
            <span className="font-semibold text-gold-foreground">{creator.growth}</span>
          </div>
          <p className="mt-2 text-sm font-bold text-foreground">{creator.name}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{creator.followers} followers · {creator.city}</p>
        </Link>
      ))}
    </div>
  );
}

const panels = slides.map((slide) => renderPanel(slide.id));

export function PulseSlideshow() {
  const [pos, setPos] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  // Auto-advance: hold still, then swish left.
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setPos((prev) => Math.min(prev + 1, count));
    }, SLIDE_DWELL_MS);
    return () => window.clearInterval(timer);
  }, [paused, count]);

  // After the last slide swishes left onto the duplicated first slide,
  // snap back with no animation so the next swish is always leftward.
  useEffect(() => {
    if (pos !== count) return;
    const timer = window.setTimeout(() => {
      setAnimate(false);
      setPos(0);
    }, SWISH_MS);
    return () => window.clearTimeout(timer);
  }, [pos, count]);

  useEffect(() => {
    if (animate) return;
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setAnimate(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [animate]);

  const activeIndex = pos % count;
  const current = slides[activeIndex]!;

  const goBack = () => {
    if (pos === 0) {
      setAnimate(false);
      setPos(count - 1);
    } else {
      setPos((prev) => prev - 1);
    }
  };

  return (
    <div
      className="space-y-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {slides.map((slide, idx) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setPos(idx)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                idx === activeIndex ? "bg-primary text-primary-foreground" : "bg-muted/70 text-muted-foreground hover:text-primary",
              )}
            >
              {slide.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link to={current.to} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
            {current.linkText} <ArrowRight className="h-3 w-3" />
          </Link>
          <div className="flex items-center gap-1">
            <button type="button" onClick={goBack} aria-label="Previous slide" className="grid h-6 w-6 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-primary">
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button type="button" onClick={() => setPos((prev) => Math.min(prev + 1, count))} aria-label="Next slide" className="grid h-6 w-6 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-primary">
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden">
        <div
          className="flex"
          style={{
            transform: `translate3d(-${pos * 100}%, 0, 0)`,
            transition: animate ? `transform ${SWISH_MS}ms cubic-bezier(0.22, 0.61, 0.36, 1)` : "none",
          }}
        >
          {[...panels, panels[0]].map((panel, idx) => (
            <Panel key={`${slides[idx % count]?.id ?? "clone"}-${idx}`}>
              {panel}
            </Panel>
          ))}
        </div>
      </div>
    </div>
  );
}
