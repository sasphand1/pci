"use client";

import { useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Bookmark, Check, ChevronRight } from "lucide-react";
import { Link } from "@/fifi/router";

import { cn } from "@/fifi/lib/utils";

export function PageIntro({ eyebrow, title, description, aside }: { eyebrow: string; title: string; description: string; aside?: ReactNode }) {
  return (
    <section className="border-b border-border py-10 sm:py-14">
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-4 font-display text-5xl font-medium leading-[1.02] tracking-[-0.035em] text-primary sm:text-6xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">{description}</p>
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, description, link, linkLabel = "View all" }: { eyebrow?: string; title: string; description?: string; link?: string; linkLabel?: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className="font-display text-3xl font-medium tracking-[-0.025em] text-primary sm:text-4xl">{title}</h2>
        {description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {link && <Link to={link} className="group hidden shrink-0 items-center gap-2 text-sm font-semibold text-primary sm:inline-flex">{linkLabel}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></Link>}
    </div>
  );
}

export function SaveButton({ label }: { label: string }) {
  const [saved, setSaved] = useState(false);
  return (
    <button type="button" onClick={() => setSaved((value) => !value)} className={cn("grid h-9 w-9 place-items-center rounded-full border shadow-sm backdrop-blur transition", saved ? "border-gold bg-gold text-gold-foreground" : "border-border/80 bg-background/90 text-foreground hover:border-gold hover:text-gold-foreground")} aria-label={saved ? `Remove ${label} from saved` : `Save ${label}`} aria-pressed={saved}>
      {saved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
    </button>
  );
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
      <button type="button" onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-primary transition hover:bg-muted disabled:opacity-35" aria-label="Previous page"><ArrowLeft className="h-4 w-4" /></button>
      {Array.from({ length: pages }, (_, index) => index + 1).map((number) => <button key={number} type="button" onClick={() => onChange(number)} className={cn("h-10 w-10 rounded-full text-sm font-semibold transition", page === number ? "bg-primary text-primary-foreground" : "border border-border bg-card text-primary hover:bg-muted")} aria-label={`Page ${number}`} aria-current={page === number ? "page" : undefined}>{number}</button>)}
      <button type="button" onClick={() => onChange(Math.min(pages, page + 1))} disabled={page === pages} className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card text-primary transition hover:bg-muted disabled:opacity-35" aria-label="Next page"><ArrowRight className="h-4 w-4" /></button>
    </nav>
  );
}

export function FollowButton({ name }: { name: string }) {
  const [following, setFollowing] = useState(false);
  return (
    <button type="button" onClick={() => setFollowing((value) => !value)} className={cn("inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold transition", following ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground hover:bg-primary-light")} aria-pressed={following} aria-label={following ? `Unfollow ${name}` : `Follow ${name}`}>
      {following && <Check className="h-3.5 w-3.5" />}{following ? "Following" : "Follow"}
    </button>
  );
}

export function EmptyState({ onReset }: { onReset: () => void }) {
  return <div className="rounded-2xl border border-dashed border-primary/25 bg-card px-6 py-16 text-center"><h3 className="font-display text-2xl text-primary">Nothing matches just yet</h3><p className="mt-2 text-sm text-muted-foreground">Try another city, category or search term.</p><button type="button" onClick={onReset} className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">Clear filters</button></div>;
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="group inline-flex items-center gap-1 text-sm font-semibold text-primary">{children}<ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></Link>;
}

/** Picture that falls back to a labelled placeholder (PH) when there is no image. */
export function Pic({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div role="img" aria-label={`Placeholder: ${alt}`} className={cn("grid h-full w-full place-items-center bg-gradient-to-br from-secondary to-muted text-primary/55", className)}>
        <span className="rounded-md border border-primary/20 bg-background/70 px-3 py-1 text-xs font-bold tracking-[0.3em]">PH</span>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} referrerPolicy="no-referrer" className={className} />;
}
