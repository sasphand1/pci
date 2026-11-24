"use client";

/**
 * Shared building blocks for the explorer pages (Creators, Local places and anything similar).
 * Every page assembles its screen from these pieces so the look and behaviour stay identical.
 */
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Crown, LayoutGrid, Link2, List, Scale, Search, X } from "lucide-react";

import { Pic } from "@/fifi/components/page-elements";
import { cn } from "@/fifi/lib/utils";
import { vsLeader, vsPercent } from "@/fifi/components/explorer-kit.helpers.mjs";

export type IconType = ComponentType<{ className?: string }>;

/* ---------- panel + header ---------- */
export const PANEL = "rounded-2xl border border-border/70 bg-card p-5 shadow-soft";

export function IconChip({ icon: Icon, className }: { icon: IconType; className?: string }) {
  return <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold-foreground", className)}><Icon className="h-5 w-5" /></span>;
}

export function PanelHeader({ icon, title, subtitle }: { icon: IconType; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <IconChip icon={icon} />
      <div><h1 className="text-xl font-bold tracking-tight text-primary sm:text-2xl">{title}</h1><p className="text-xs text-muted-foreground">{subtitle}</p></div>
    </div>
  );
}

export function SearchBox({ value, onChange, onSubmit, placeholder, label, className }: { value: string; onChange: (v: string) => void; onSubmit: () => void; placeholder: string; label: string; className?: string }) {
  return (
    <form className={cn("relative", className)} onSubmit={(e) => { e.preventDefault(); onSubmit(); }} role="search">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <input value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-full border border-border bg-secondary/50 pl-9 pr-3 text-xs font-medium text-primary outline-none placeholder:text-muted-foreground focus:border-primary/40" placeholder={placeholder} aria-label={label} />
    </form>
  );
}

export type Kpi = { label: string; value: string; sub: string; icon: IconType; plain?: boolean };
export function KpiTile({ item }: { item: Kpi }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/60 p-3.5">
      <div className="flex items-start gap-2.5">
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", item.plain ? "bg-background ring-1 ring-border/70" : "bg-secondary text-primary")}><item.icon className="h-4 w-4" /></span>
        <div className="min-w-0"><p className="truncate text-base font-bold leading-tight text-foreground">{item.value}</p><p className="truncate text-[10px] font-medium text-muted-foreground">{item.label}</p></div>
      </div>
      <p className="mt-2.5 truncate text-[10px] text-muted-foreground">{item.sub}</p>
    </div>
  );
}

/* ---------- controls ---------- */
export type Tab = { id: string; label: string; icon?: IconType };
export function UnderlineTabs({ tabs, value, onChange, label }: { tabs: readonly Tab[]; value: string; onChange: (id: string) => void; label: string }) {
  return (
    <div className="flex gap-5" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.id || "all"} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cn("inline-flex items-center gap-1.5 border-b-2 pb-2.5 text-xs font-semibold transition", value === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
          {t.icon && <t.icon className="h-3.5 w-3.5" />} {t.label}
        </button>
      ))}
    </div>
  );
}

export function PillSelect({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: readonly { id: string; label: string }[]; label: string }) {
  return <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="h-8 rounded-full border border-border bg-secondary/50 px-3 text-xs font-semibold text-primary outline-none">{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>;
}

export function ViewToggle({ view, onChange }: { view: "list" | "grid"; onChange: (v: "list" | "grid") => void }) {
  const grid = view === "grid";
  return (
    <div role="group" aria-label="Layout" className="inline-flex rounded-full border border-border bg-secondary/50 p-0.5">
      <button type="button" aria-pressed={!grid} aria-label="List view" onClick={() => onChange("list")} className={cn("grid h-7 w-7 place-items-center rounded-full", !grid ? "bg-primary text-primary-foreground" : "text-muted-foreground")}><List className="h-3.5 w-3.5" /></button>
      <button type="button" aria-pressed={grid} aria-label="Grid view" onClick={() => onChange("grid")} className={cn("grid h-7 w-7 place-items-center rounded-full", grid ? "bg-primary text-primary-foreground" : "text-muted-foreground")}><LayoutGrid className="h-3.5 w-3.5" /></button>
    </div>
  );
}

export function ChipRow({ chips, value, onChange }: { chips: readonly { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
      {chips.map((c) => (
        <button key={c.id || "all"} type="button" onClick={() => onChange(c.id)}
          className={cn("h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition", value === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary/50 text-primary hover:bg-secondary")}>{c.label}</button>
      ))}
    </div>
  );
}

/** Platform or option buttons inside a slot or a dialog header. Unavailable options stay visible but disabled. */
export function OptionButtons({ options, value, onChange, label, size = "md", iconOnly = false }: { options: { id: string; label: string; icon?: IconType; disabled?: boolean; hint?: string }[]; value: string; onChange: (id: string) => void; label: string; size?: "sm" | "md"; iconOnly?: boolean }) {
  return (
    <div className="flex gap-1" role="group" aria-label={label}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button key={o.id} type="button" disabled={o.disabled} title={o.disabled ? o.hint : undefined} aria-pressed={on} onClick={() => onChange(o.id)}
            className={cn("inline-flex flex-1 items-center justify-center gap-1 font-semibold transition", size === "sm" ? "h-6 rounded-full px-2.5 text-[10px]" : "h-7 rounded-md text-[10px]",
              on ? "bg-gold-soft text-gold-foreground ring-1 ring-gold" : o.disabled ? "cursor-not-allowed bg-secondary/50 text-muted-foreground opacity-50 grayscale" : "bg-secondary text-primary hover:bg-secondary/70")}>
            {o.icon && <o.icon className="h-3 w-3" />}{iconOnly ? <span className="sr-only">{o.label}</span> : o.label}
          </button>
        );
      })}
    </div>
  );
}

/** The compare button on a row or card. */
export function CompareToggle({ name, selected, full, onToggle, limit }: { name: string; selected: boolean; full: boolean; onToggle: () => void; limit: number }) {
  const blocked = full && !selected;
  return (
    <button type="button" onClick={onToggle} disabled={blocked} aria-pressed={selected} aria-label={selected ? `Remove ${name} from comparison` : `Add ${name} to comparison`}
      title={blocked ? `Head to head compares ${limit}` : undefined}
      className={cn("inline-flex h-7 items-center justify-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40", selected ? "bg-primary text-primary-foreground" : "bg-secondary text-primary hover:bg-secondary/70")}>
      {selected ? "✓ Added" : "+ Compare"}
    </button>
  );
}

/** A picture, or an icon tile when the thing has no picture (restaurants, say). */
export function Thumb({ src, alt, fallback: Fallback, className }: { src?: string | null; alt: string; fallback?: IconType; className?: string }) {
  if (!src && Fallback) return <span className="grid h-full w-full place-items-center bg-secondary text-primary"><Fallback className={className ?? "h-1/2 w-1/2"} /></span>;
  return <Pic src={src} alt={alt} className="h-full w-full object-cover" />;
}

/* ---------- head to head ---------- */
export type Entity = { key: string; name: string; image?: string | null; sub?: string; fallback?: IconType };
export function HeadToHeadCard({ items, pool, onPick, onRemove, onClear, onCompare, subtitle, slotExtra }: {
  items: Entity[]; pool: Entity[]; onPick: (key: string) => void; onRemove: (key: string) => void; onClear: () => void; onCompare: () => void; subtitle: string; slotExtra?: (e: Entity) => ReactNode;
}) {
  return (
    <aside className="rounded-2xl border border-border/70 bg-secondary/40 p-4" aria-label="Head to head">
      <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-gold-soft text-gold-foreground"><Scale className="h-4 w-4" /></span><div><p className="text-sm font-bold text-primary">Head to head</p><p className="text-[10px] text-muted-foreground">{subtitle}</p></div></div>
      <div className="mt-3 space-y-2">
        {[0, 1].map((i) => {
          const c = items[i];
          if (!c) return (
            <label key={i} className="block rounded-xl border border-dashed border-border bg-background/60 p-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Choice {i === 0 ? "A" : "B"}</span>
              <select value="" onChange={(e) => { if (e.target.value) onPick(e.target.value); }} className="mt-1 h-8 w-full rounded-lg border border-border bg-card px-2 text-xs font-semibold text-primary outline-none" aria-label={`Choose ${i === 0 ? "A" : "B"}`}>
                <option value="">Choose…</option>
                {pool.filter((p) => !items.some((s) => s.key === p.key)).map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
              </select>
            </label>
          );
          return (
            <div key={c.key} className="rounded-xl border border-border/70 bg-background/60 p-2.5">
              <div className="flex items-center gap-2">
                <span className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-muted"><Thumb src={c.image} alt={c.name} fallback={c.fallback} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-foreground">{c.name}</span><span className="block text-[10px] text-muted-foreground">{c.sub ?? `Choice ${i === 0 ? "A" : "B"}`}</span></span>
                <button type="button" onClick={() => onRemove(c.key)} aria-label={`Remove ${c.name}`} className="text-muted-foreground hover:text-primary"><X className="h-3.5 w-3.5" /></button>
              </div>
              {slotExtra && <div className="mt-2">{slotExtra(c)}</div>}
            </div>
          );
        })}
      </div>
      <button type="button" disabled={items.length < 2} onClick={onCompare} className="mt-3 h-9 w-full rounded-xl bg-primary text-xs font-semibold text-primary-foreground transition hover:bg-primary-light disabled:opacity-40">{items.length < 2 ? `Pick ${2 - items.length} more` : "Compare now"}</button>
      {items.length > 0 && <button type="button" onClick={onClear} className="mt-1.5 w-full text-center text-[10px] font-semibold text-muted-foreground hover:text-primary">Clear</button>}
    </aside>
  );
}

/* ---------- versus dialog ---------- */
export type VsSide = { name: string; image?: string | null; fallback?: IconType; href?: string; sub?: string; extra?: ReactNode };
export type VsRow = { label: string; hint?: string; a: number | null; b: number | null; format: (n: number) => string; /** Bars measure against this maximum; default is the higher of the two. */ max?: number };

function VsSideHead({ side }: { side: VsSide }) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <span className="h-16 w-16 overflow-hidden rounded-2xl bg-muted ring-2 ring-white/60"><Thumb src={side.image} alt={side.name} fallback={side.fallback} /></span>
      {side.href ? <a href={side.href} className="mt-2 block max-w-full truncate text-sm font-bold text-primary hover:underline">{side.name}</a> : <span className="mt-2 block max-w-full truncate text-sm font-bold text-primary">{side.name}</span>}
      {side.sub && <span className="text-[10px] text-muted-foreground">{side.sub}</span>}
      {side.extra && <div className="mt-2">{side.extra}</div>}
    </div>
  );
}

export function VsDialog({ left, right, rows, footer, onClose, state = "ready", ariaLabel = "Compare" }: {
  left: VsSide | null; right: VsSide | null; rows: VsRow[]; footer: string; onClose: () => void; state?: "loading" | "ready" | "error"; ariaLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  }
  const ready = left && right;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/30 p-3 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/50 bg-card/75 shadow-lift backdrop-blur-2xl">
        <header className="flex items-center justify-between gap-3 px-5 pt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Head to head</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/50 px-3 py-1.5 text-[11px] font-semibold text-primary hover:bg-white/80"><Link2 className="h-3.5 w-3.5" />{copied ? "Link copied" : "Copy link"}</button>
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close comparison" className="grid h-8 w-8 place-items-center rounded-full border border-white/60 bg-white/50 text-primary hover:bg-white/80"><X className="h-4 w-4" /></button>
          </div>
        </header>
        <div className="overflow-auto px-5 pb-5">
          {state === "loading" && !ready && <p className="py-16 text-center text-sm text-muted-foreground">Loading the latest numbers…</p>}
          {state === "error" && !ready && <p className="py-16 text-center text-sm text-muted-foreground">The comparison could not be loaded. Try again in a moment.</p>}
          {ready && (
            <>
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
                <VsSideHead side={left} />
                <span className="mt-5 grid h-9 w-9 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">VS</span>
                <VsSideHead side={right} />
              </div>
              <ul className="mt-5 space-y-4">
                {rows.map((m) => {
                  const lead = vsLeader(m.a, m.b);
                  const pa = vsPercent(m.a, m.b, m.max), pb = vsPercent(m.b, m.a, m.max);
                  return (
                    <li key={m.label} className="rounded-2xl border border-white/60 bg-white/45 px-3.5 py-3">
                      <p className="text-center text-xs font-bold text-foreground">{m.label}</p>
                      {m.hint && <p className="text-center text-[10px] text-muted-foreground">{m.hint}</p>}
                      <div className="mt-2 grid grid-cols-[4.5rem_1fr_1fr_4.5rem] items-center gap-2">
                        <span className="flex items-center justify-end gap-1 text-right text-xs font-bold text-foreground">{lead === 0 && <Crown className="h-3 w-3 text-gold" aria-label="Highest" />}{m.a === null ? <span className="text-[10px] font-medium text-muted-foreground">Not available</span> : m.format(m.a)}</span>
                        {pa === null ? <span /> : <progress className="cmp-meter cmp-meter-flip" value={pa} max={100} aria-label={`${m.label}, ${left.name}: ${pa}%`} />}
                        {pb === null ? <span /> : <progress className="cmp-meter cmp-meter-b" value={pb} max={100} aria-label={`${m.label}, ${right.name}: ${pb}%`} />}
                        <span className="flex items-center gap-1 text-xs font-bold text-foreground">{m.b === null ? <span className="text-[10px] font-medium text-muted-foreground">Not available</span> : m.format(m.b)}{lead === 1 && <Crown className="h-3 w-3 text-gold" aria-label="Highest" />}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
        <footer className="border-t border-white/50 px-5 py-3 text-[10px] leading-5 text-muted-foreground">{footer}</footer>
      </div>
    </div>
  );
}
