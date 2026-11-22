"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useRouterState } from "@/fifi/router";
import { ArrowRight, Heart, Instagram, Linkedin, Menu, Search, X, Youtube } from "lucide-react";

import { FifiAssistant, openFifi } from "@/fifi/components/fifi-assistant";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/fifi/components/ui/dialog";
import { businesses, creators, events, stories } from "@/fifi/lib/fifi-data";
import { dramas } from "@/fifi/lib/fifi-extras";
import { cn } from "@/fifi/lib/utils";

const navigation = [
  { label: "Home", to: "/" },
  { label: "Creators", to: "/creators" },
  { label: "Dramas", to: "/dramas" },
  { label: "Events", to: "/events" },
  { label: "Local", to: "/local" },
  { label: "Satellite", to: "/satellite" },
  { label: "Insights", to: "/insights" },
  { label: "About", to: "/about" },
] as const;

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link to="/" className="group inline-flex items-start gap-1" aria-label="Fifi home">
      <span className={cn("font-display text-[2rem] font-semibold leading-none tracking-[-0.055em]", inverse ? "text-primary-foreground" : "text-primary")}>fifi</span>
      <Heart className="mt-0.5 h-3.5 w-3.5 fill-gold text-gold transition-transform group-hover:rotate-12" aria-hidden="true" />
    </Link>
  );
}

export function SiteHeader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const open = () => setAssistantOpen(true);
    window.addEventListener("fifi:open", open);
    return () => window.removeEventListener("fifi:open", open);
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const items = [
      ...creators.map((item) => ({ title: item.name, meta: `${item.category} creator · ${item.city}`, to: "/creators" })),
      ...dramas.map((item) => ({ title: item.title, meta: `${item.network} · ${item.weeklyViewsM}M weekly views`, to: "/dramas" })),
      ...events.map((item) => ({ title: item.title, meta: `${item.dateLabel} · ${item.city}`, to: "/events" })),
      ...businesses.map((item) => ({ title: item.name, meta: `${item.category} · ${item.area}, ${item.city}`, to: "/local" })),
      ...stories.map((item) => ({ title: item.title, meta: `${item.category} · ${item.readTime}`, to: "/insights" })),
    ];
    return items.filter((item) => `${item.title} ${item.meta}`.toLowerCase().includes(q)).slice(0, 6);
  }, [query]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (query.trim()) setSearchOpen(true);
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-xl">
        <div className="site-container flex h-[76px] items-center gap-6">
          <Logo />
          <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            {navigation.map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <Link key={item.to} to={item.to} className={cn("relative rounded-md px-3 py-2 text-sm font-medium transition-colors", active ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
                  {item.label}
                  {active && <span className="absolute inset-x-3 -bottom-[19px] h-0.5 rounded-full bg-gold" />}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <form onSubmit={submitSearch} className="relative hidden xl:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => query && setSearchOpen(true)}
                className="h-10 w-56 rounded-full border border-transparent bg-muted/70 pl-9 pr-3 text-sm outline-none transition focus:border-primary/20 focus:bg-background focus:ring-2 focus:ring-primary/10"
                placeholder="Search Fifi…"
                aria-label="Search Fifi"
              />
            </form>
            <button type="button" onClick={() => setSearchOpen(true)} className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-primary xl:hidden" aria-label="Open search">
              <Search className="h-5 w-5" />
            </button>
            <button type="button" onClick={openFifi} className="hidden h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary-light sm:inline-flex">
              Ask Fifi <SparkleMark />
            </button>
            <button type="button" onClick={() => setMobileOpen((value) => !value)} className="grid h-10 w-10 place-items-center rounded-full hover:bg-muted lg:hidden" aria-label="Toggle navigation" aria-expanded={mobileOpen}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <nav className="border-t border-border bg-background px-5 py-4 lg:hidden" aria-label="Mobile navigation">
            <div className="mx-auto grid max-w-xl grid-cols-2 gap-2">
              {navigation.map((item) => (
                <Link key={item.to} to={item.to} className="rounded-lg px-4 py-3 text-sm font-medium hover:bg-muted">{item.label}</Link>
              ))}
              <button type="button" onClick={() => { setMobileOpen(false); openFifi(); }} className="col-span-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">Ask Fifi</button>
            </div>
          </nav>
        )}
      </header>

      <Dialog open={assistantOpen} onOpenChange={setAssistantOpen}>
        <DialogContent className="max-w-xl border-primary/15 bg-background p-0 sm:rounded-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Ask Fifi</DialogTitle>
            <DialogDescription>Explore Fifi's curated guides to Pakistan.</DialogDescription>
          </DialogHeader>
          <FifiAssistant compact className="border-0 shadow-none" />
        </DialogContent>
      </Dialog>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="top-[18%] translate-y-0 gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
          <DialogHeader className="sr-only"><DialogTitle>Search Fifi</DialogTitle><DialogDescription>Search creators, events, places and stories.</DialogDescription></DialogHeader>
          <div className="flex items-center gap-3 border-b border-border px-5 py-4 pr-12">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search creators, places, events and stories…" className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none" />
          </div>
          <div className="max-h-[55vh] overflow-y-auto p-3">
            {!query.trim() ? (
              <div className="px-3 py-8 text-center">
                <p className="font-display text-2xl text-primary">What are you curious about?</p>
                <p className="mt-2 text-sm text-muted-foreground">Try “Lahore”, “food”, “travel” or a creator's name.</p>
              </div>
            ) : results.length ? results.map((result) => (
              <Link key={`${result.to}-${result.title}`} to={result.to} onClick={() => setSearchOpen(false)} className="group flex items-center justify-between rounded-xl px-4 py-3 transition hover:bg-muted">
                <span><span className="block text-sm font-semibold">{result.title}</span><span className="mt-1 block text-xs text-muted-foreground">{result.meta}</span></span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
              </Link>
            )) : <p className="px-4 py-10 text-center text-sm text-muted-foreground">No matches yet. Try a city, category or shorter name.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SparkleMark() {
  return <span className="grid h-5 w-5 place-items-center rounded-full bg-gold text-[11px] text-gold-foreground">✦</span>;
}

export function SiteFooter() {
  return (
    <footer className="mt-10 w-full bg-primary text-primary-foreground">
      <div className="mx-auto grid w-full max-w-[1600px] grid-cols-2 gap-6 px-4 py-6 sm:px-8 sm:py-8 md:grid-cols-[1.4fr_repeat(3,1fr)] md:gap-8 lg:px-10">
        <div className="col-span-2 md:col-span-1">
          <Logo inverse />
          <p className="mt-2 font-display text-lg leading-snug text-primary-foreground">Pakistan's people. Places. Possibilities.</p>
          <p className="mt-1 max-w-xs text-xs leading-5 text-primary-foreground/60">Independent, useful and made for curious Pakistanis everywhere.</p>
        </div>
        <FooterLinks title="Explore" links={[{ label: "Creators", to: "/creators" }, { label: "Top Dramas", to: "/dramas" }, { label: "Events", to: "/events" }, { label: "Local guide", to: "/local" }]} />
        <FooterLinks title="Intelligence" links={[{ label: "Satellite", to: "/satellite" }, { label: "Insights", to: "/insights" }, { label: "Methodology", to: "/methodology" }, { label: "About", to: "/about" }]} />
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-soft">Follow</h3>
          <button type="button" onClick={openFifi} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-gold-soft hover:text-primary-foreground">Ask Fifi <ArrowRight className="h-4 w-4" /></button>
          <div className="mt-3 flex gap-2">
            {[Instagram, Youtube, Linkedin].map((Icon, index) => <span key={index} className="grid h-8 w-8 place-items-center rounded-full border border-primary-foreground/20 text-primary-foreground/70" aria-hidden="true"><Icon className="h-4 w-4" /></span>)}
          </div>
        </div>
      </div>
      <div className="border-t border-primary-foreground/15">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-5 py-3 text-xs text-primary-foreground/55 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <p>© 2026 Fifi. Built with care in Pakistan.</p>
          <p className="flex flex-wrap gap-x-4 gap-y-1"><Link to="/privacy" className="hover:text-primary-foreground">Privacy</Link><Link to="/terms" className="hover:text-primary-foreground">Terms</Link><Link to="/contact" className="hover:text-primary-foreground">Contact</Link></p>
        </div>
      </div>
    </footer>
  );
}

function FooterLinks({ title, links }: { title: string; links: ReadonlyArray<{ label: string; to: string }> }) {
  return <div><h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-gold-soft">{title}</h3><div className="mt-3 flex flex-col items-start gap-1.5">{links.map((link) => <Link key={link.label} to={link.to} className="text-sm text-primary-foreground/70 transition hover:text-primary-foreground">{link.label}</Link>)}</div></div>;
}
