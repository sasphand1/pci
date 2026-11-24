"use client";

import { useEffect, useRef, useState } from "react";
import { Crown, Link2, Scale, X } from "lucide-react";

import { Pic } from "@/fifi/components/page-elements";
import { cn } from "@/fifi/lib/utils";
import { formatCount } from "@/lib/format.mjs";
import { asOfLabel, barPercent, leaderIndex } from "@/lib/creators.mjs";
import type { PubCreatorRow } from "@/lib/public";

type Metric = { label: string; hint?: string; values: (number | null)[]; format: (n: number) => string; bars?: boolean };
const usd = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const num = (n: number) => formatCount(String(Math.trunc(n)), true);
const gain = (n: number) => `${n > 0 ? "+" : ""}${num(n)}`;

type Plat = "overall" | "youtube" | "instagram" | "tiktok";
const PLATS: { id: Plat; label: string }[] = [{ id: "overall", label: "Overall" }, { id: "youtube", label: "YouTube" }, { id: "instagram", label: "Instagram" }, { id: "tiktok", label: "TikTok" }];
const has = (r: PubCreatorRow, p: string) => r.accounts.some((a) => a.platform === p);
function sumOf(r: PubCreatorRow, p: Plat, field: "followers" | "views" | "posts30d"): number | null {
  const xs = r.accounts.filter((a) => (p === "overall" || a.platform === p) && a[field] !== null).map((a) => a[field] as number);
  return xs.length ? xs.reduce((x, y) => x + y, 0) : null;
}

function metricsFor(rows: PubCreatorRow[], p: Plat): Metric[] {
  const word = p === "youtube" ? "Subscribers" : "Followers";
  const base: Metric[] = [
    { label: p === "overall" ? "Total followers" : word, hint: p === "overall" ? "All accounts, last recorded" : "Last recorded", values: rows.map((r) => (p === "overall" ? r.totalFollowers : sumOf(r, p, "followers"))), format: num, bars: true },
  ];
  if (p === "overall" || p === "youtube" || p === "tiktok") base.push({ label: p === "overall" ? "Total views" : "Lifetime views", hint: "Last recorded", values: rows.map((r) => sumOf(r, p, "views")), format: num, bars: true });
  base.push({ label: "Posts, last 30 days", values: rows.map((r) => sumOf(r, p, "posts30d")), format: num, bars: true });
  if (p === "overall") {
    base.push(
      { label: "Followers gained · 7 days", hint: "Against their own previous figure", values: rows.map((r) => r.growth?.subscribers["7d"] ?? null), format: gain, bars: true },
      { label: "Followers gained · 30 days", values: rows.map((r) => r.growth?.subscribers["30d"] ?? null), format: gain, bars: true },
      { label: "Views gained · 30 days", values: rows.map((r) => r.growth?.views["30d"] ?? null), format: gain, bars: true },
    );
  }
  if (p === "overall" || p === "youtube") base.push({ label: "Modeled monthly earnings (USD)", hint: "Estimate, not reported income", values: rows.map((r) => r.earningsUsd), format: usd, bars: true });
  if (p === "overall" || p === "instagram") base.push({ label: "Instagram sponsorship scenario", hint: "Hypothetical: one paid post", values: rows.map((r) => r.instagramSponsorScenarioUsd), format: usd, bars: true });
  return base;
}

export function ComparePanel({ slugs, initial, onClose, onRemove }: { slugs: string[]; initial: PubCreatorRow[]; onClose: () => void; onRemove: (slug: string) => void }) {
  const [rows, setRows] = useState<PubCreatorRow[]>(initial.filter((r) => slugs.includes(r.slug) && r.growth));
  const [state, setState] = useState<"loading" | "ready" | "error">(rows.length === slugs.length ? "ready" : "loading");
  const [copied, setCopied] = useState(false);
  const [plat, setPlat] = useState<Plat>("overall");
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
  const available = PLATS.filter((x) => x.id === "overall" || shown.some((r) => has(r, x.id)));
  const active: Plat = available.some((x) => x.id === plat) ? plat : "overall";
  const metrics = metricsFor(shown, active);
  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-primary/40 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Compare creators">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-border/70 bg-card shadow-lift sm:rounded-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold-foreground"><Scale className="h-5 w-5" /></div><div><h2 className="text-xl font-bold tracking-tight text-primary">Compare {slugs.length} creators</h2><p className="text-xs text-muted-foreground">Side by side, from the latest recorded figures.</p></div></div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold text-primary hover:bg-secondary"><Link2 className="h-3.5 w-3.5" />{copied ? "Link copied" : "Copy link"}</button>
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close comparison" className="grid h-9 w-9 place-items-center rounded-full border border-border text-primary hover:bg-secondary"><X className="h-4 w-4" /></button>
          </div>
        </header>
        <div className="flex gap-5 border-b border-border/80 px-5 pt-3" role="tablist" aria-label="Platform">
          {available.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={active === x.id} onClick={() => setPlat(x.id)}
              className={cn("border-b-2 pb-2.5 text-xs font-semibold transition", active === x.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{x.label}</button>
          ))}
        </div>
        <div className="overflow-auto">
          {state === "loading" && shown.length === 0 && <p className="px-6 py-16 text-center text-sm text-muted-foreground">Loading the latest numbers…</p>}
          {state === "error" && shown.length === 0 && <p className="px-6 py-16 text-center text-sm text-muted-foreground">The comparison could not be loaded. Try again in a moment.</p>}
          {shown.length > 0 && (
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 bg-card">
                <tr>
                  <th scope="col" className="w-48 px-5 py-4" />
                  {shown.map((r) => (
                    <th key={r.slug} scope="col" className="px-4 py-4 align-top">
                      <div className="flex items-center gap-3"><span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted"><Pic src={r.avatarUrl} alt={r.displayName} className="h-full w-full object-cover" /></span>
                        <span className="min-w-0"><a href={`/creators/${r.slug}`} className="block truncate text-sm font-bold text-primary hover:underline">{r.displayName}</a>
                          <span className="block text-xs font-normal text-muted-foreground">{r.rank !== null ? `Most Subscribed #${r.rank}` : "Not ranked"} · {asOfLabel(r.asOf) || "no date"}</span></span>
                        <button type="button" onClick={() => onRemove(r.slug)} aria-label={`Remove ${r.displayName}`} className="ml-auto text-muted-foreground hover:text-primary"><X className="h-4 w-4" /></button></div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => {
                  const lead = leaderIndex(m.values);
                  return (
                    <tr key={m.label} className="border-t border-border">
                      <th scope="row" className="px-5 py-4 align-top"><span className="block text-xs font-bold text-foreground">{m.label}</span>{m.hint && <span className="block text-[10px] font-normal text-muted-foreground">{m.hint}</span>}</th>
                      {m.values.map((v, i) => {
                        const pct = m.bars ? barPercent(v, m.values) : null;
                        return (
                          <td key={shown[i].slug} className={cn("px-4 py-4 align-top", lead === i && "bg-secondary/60")}>
                            {v === null ? <span className="text-muted-foreground">Not available</span> : (
                              <>
                                <span className="flex items-center gap-1.5 font-semibold text-foreground">{m.format(v)}{lead === i && <Crown className="h-3.5 w-3.5 text-gold" aria-label="Highest" />}</span>
                                {pct !== null && <progress className="cmp-meter mt-2" value={pct} max={100} aria-label={`${m.label}: ${pct}% of the highest`} />}
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <footer className="border-t border-border px-5 py-3 text-[11px] leading-5 text-muted-foreground">Figures are each creator’s last recorded values, dated above. Growth is shown only where real history exists. Earnings are modeled estimates and sponsorship is a hypothetical scenario, not reported income. “Not available” means no figure has been recorded, not zero.</footer>
      </div>
    </div>
  );
}
