"use client";

import { useEffect, useRef, useState } from "react";
import { Crown, Link2, X } from "lucide-react";

import { PlatformIcon } from "@/fifi/components/platform-icon";
import { Pic } from "@/fifi/components/page-elements";
import { cn } from "@/fifi/lib/utils";
import { formatCount } from "@/lib/format.mjs";
import { asOfLabel, barPercent, leaderIndex } from "@/lib/creators.mjs";
import type { PubCreatorRow } from "@/lib/public";

export type Plat = "youtube" | "instagram" | "tiktok";
export const PLAT_LABEL: Record<Plat, string> = { youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok" };
export const PLAT_ORDER: Plat[] = ["youtube", "instagram", "tiktok"];
const ORDER = PLAT_ORDER;
export const hasPlat = (r: PubCreatorRow, p: Plat) => r.accounts.some((a) => a.platform === p);
export const platBtn = (on: boolean, off: boolean) => (on ? "bg-gold-soft text-gold-foreground ring-1 ring-gold" : off ? "cursor-not-allowed bg-secondary/50 text-muted-foreground opacity-50" : "bg-secondary text-primary hover:bg-secondary/70");
export const platsOf = (r: PubCreatorRow): Plat[] => { const l = ORDER.filter((p) => r.accounts.some((a) => a.platform === p)); return l.length ? l : ["youtube"]; };
export const firstPlatform = (r: PubCreatorRow): Plat => platsOf(r)[0];

const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const num = (n: number) => formatCount(String(Math.trunc(n)), true);
const gain = (n: number) => `${n > 0 ? "+" : ""}${num(n)}`;
function sumOf(r: PubCreatorRow, p: Plat, field: "followers" | "views" | "posts30d"): number | null {
  const xs = r.accounts.filter((a) => a.platform === p && a[field] !== null).map((a) => a[field] as number);
  return xs.length ? xs.reduce((x, y) => x + y, 0) : null;
}
type Row = { label: string; hint?: string; a: number | null; b: number | null; format: (n: number) => string };

function rowsFor(a: PubCreatorRow, pa: Plat, b: PubCreatorRow, pb: Plat): Row[] {
  const aud = (p: Plat) => (p === "youtube" ? "subscribers" : "followers");
  return [
    { label: pa === pb ? (pa === "youtube" ? "Subscribers" : "Followers") : "Audience", hint: pa === pb ? "Last recorded" : `${aud(pa)} vs ${aud(pb)}`, a: sumOf(a, pa, "followers"), b: sumOf(b, pb, "followers"), format: num },
    { label: "Lifetime views", hint: "Last recorded", a: sumOf(a, pa, "views"), b: sumOf(b, pb, "views"), format: num },
    { label: "Posts, last 30 days", a: sumOf(a, pa, "posts30d"), b: sumOf(b, pb, "posts30d"), format: num },
    { label: "Modeled monthly earnings", hint: "YouTube estimate, not reported income", a: pa === "youtube" ? a.earningsUsd : null, b: pb === "youtube" ? b.earningsUsd : null, format: usd },
    { label: "Instagram sponsored post", hint: "Hypothetical scenario", a: pa === "instagram" ? a.instagramSponsorScenarioUsd : null, b: pb === "instagram" ? b.instagramSponsorScenarioUsd : null, format: usd },
    { label: "Audience gained · 30 days", hint: "All accounts, vs their own earlier figure", a: a.growth?.subscribers["30d"] ?? null, b: b.growth?.subscribers["30d"] ?? null, format: gain },
    { label: "Views gained · 30 days", hint: "All accounts, vs their own earlier figure", a: a.growth?.views["30d"] ?? null, b: b.growth?.views["30d"] ?? null, format: gain },
  ];
}

function Side({ r, p, onPlat }: { r: PubCreatorRow; p: Plat; onPlat: (p: Plat) => void }) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <span className="h-16 w-16 overflow-hidden rounded-2xl bg-muted ring-2 ring-white/60"><Pic src={r.avatarUrl} alt={r.displayName} className="h-full w-full object-cover" /></span>
      <a href={`/creators/${r.slug}`} className="mt-2 block max-w-full truncate text-sm font-bold text-primary hover:underline">{r.displayName}</a>
      <span className="text-[10px] text-muted-foreground">{r.rank !== null ? `Most Subscribed #${r.rank}` : "Not ranked"} · {asOfLabel(r.asOf) || "no date"}</span>
      <div className="mt-2 flex gap-1" role="group" aria-label={`Platform for ${r.displayName}`}>
        {PLAT_ORDER.map((pl) => { const off = !hasPlat(r, pl); return <button key={pl} type="button" disabled={off} title={off ? `No ${PLAT_LABEL[pl]} account` : undefined} aria-pressed={p === pl} onClick={() => onPlat(pl)} className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[10px] font-semibold transition", platBtn(p === pl, off), off && "grayscale")}><PlatformIcon platform={pl} className="h-3 w-3" />{PLAT_LABEL[pl]}</button>; })}
      </div>
    </div>
  );
}

export function ComparePanel({ slugs, plats, onPlat, initial, onClose }: { slugs: string[]; plats: Record<string, Plat>; onPlat: (slug: string, p: Plat) => void; initial: PubCreatorRow[]; onClose: () => void }) {
  const [rows, setRows] = useState<PubCreatorRow[]>(initial.filter((r) => slugs.includes(r.slug) && r.growth));
  const [state, setState] = useState<"loading" | "ready" | "error">(rows.length === slugs.length ? "ready" : "loading");
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const key = slugs.join(",");

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetch(`/api/creator-compare?slugs=${encodeURIComponent(key)}`, { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((b: { data: PubCreatorRow[] }) => { if (alive) { setRows(b.data); setState("ready"); } })
      .catch(() => { if (alive) setState("error"); });
    return () => { alive = false; };
  }, [key]);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const shown = slugs.map((s) => rows.find((r) => r.slug === s)).filter(Boolean) as PubCreatorRow[];
  const [A, B] = shown;
  const pa = A ? (plats[A.slug] ?? firstPlatform(A)) : "youtube";
  const pb = B ? (plats[B.slug] ?? firstPlatform(B)) : "youtube";
  const table = A && B ? rowsFor(A, pa, B, pb) : [];
  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/30 p-3 backdrop-blur-md sm:p-6" role="dialog" aria-modal="true" aria-label="Compare creators">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/50 bg-card/75 shadow-lift backdrop-blur-2xl">
        <header className="flex items-center justify-between gap-3 px-5 pt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Head to head</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-full border border-white/60 bg-white/50 px-3 py-1.5 text-[11px] font-semibold text-primary hover:bg-white/80"><Link2 className="h-3.5 w-3.5" />{copied ? "Link copied" : "Copy link"}</button>
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close comparison" className="grid h-8 w-8 place-items-center rounded-full border border-white/60 bg-white/50 text-primary hover:bg-white/80"><X className="h-4 w-4" /></button>
          </div>
        </header>
        <div className="overflow-auto px-5 pb-5">
          {state === "loading" && !(A && B) && <p className="py-16 text-center text-sm text-muted-foreground">Loading the latest numbers…</p>}
          {state === "error" && !(A && B) && <p className="py-16 text-center text-sm text-muted-foreground">The comparison could not be loaded. Try again in a moment.</p>}
          {A && B && (
            <>
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-start gap-3">
                <Side r={A} p={pa} onPlat={(p) => onPlat(A.slug, p)} />
                <span className="mt-5 grid h-9 w-9 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">VS</span>
                <Side r={B} p={pb} onPlat={(p) => onPlat(B.slug, p)} />
              </div>
              <ul className="mt-5 space-y-4">
                {table.map((m) => {
                  const lead = leaderIndex([m.a, m.b]);
                  const both = [m.a, m.b];
                  const pctA = barPercent(m.a, both);
                  const pctB = barPercent(m.b, both);
                  return (
                    <li key={m.label} className="rounded-2xl border border-white/60 bg-white/45 px-3.5 py-3">
                      <p className="text-center text-xs font-bold text-foreground">{m.label}</p>
                      {m.hint && <p className="text-center text-[10px] text-muted-foreground">{m.hint}</p>}
                      <div className="mt-2 grid grid-cols-[4.5rem_1fr_1fr_4.5rem] items-center gap-2">
                        <span className="flex items-center justify-end gap-1 text-right text-xs font-bold text-foreground">{lead === 0 && <Crown className="h-3 w-3 text-gold" aria-label="Highest" />}{m.a === null ? <span className="text-[10px] font-medium text-muted-foreground">Not available</span> : m.format(m.a)}</span>
                        {pctA === null ? <span /> : <progress className="cmp-meter cmp-meter-flip" value={pctA} max={100} aria-label={`${m.label}, ${A.displayName}: ${pctA}% of the higher`} />}
                        {pctB === null ? <span /> : <progress className="cmp-meter cmp-meter-b" value={pctB} max={100} aria-label={`${m.label}, ${B.displayName}: ${pctB}% of the higher`} />}
                        <span className="flex items-center gap-1 text-xs font-bold text-foreground">{m.b === null ? <span className="text-[10px] font-medium text-muted-foreground">Not available</span> : m.format(m.b)}{lead === 1 && <Crown className="h-3 w-3 text-gold" aria-label="Highest" />}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
        <footer className="border-t border-white/50 px-5 py-3 text-[10px] leading-5 text-muted-foreground">Figures are each creator’s last recorded values on the chosen platform. Gains compare each creator with their own earlier figures. Earnings are modeled estimates and the sponsorship is a hypothetical scenario, not reported income. “Not available” means no figure has been recorded, not zero.</footer>
      </div>
    </div>
  );
}
