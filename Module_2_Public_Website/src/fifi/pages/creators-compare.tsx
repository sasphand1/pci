"use client";

import { useEffect, useState } from "react";

import { PlatformIcon } from "@/fifi/components/platform-icon";
import { OptionButtons, VsDialog, type VsRow, type VsSide } from "@/fifi/components/explorer-kit";
import { formatCount } from "@/lib/format.mjs";
import { asOfLabel } from "@/lib/creators.mjs";
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

function rowsFor(a: PubCreatorRow, pa: Plat, b: PubCreatorRow, pb: Plat): VsRow[] {
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

export const platOptions = (r: PubCreatorRow) => PLAT_ORDER.map((pl) => ({ id: pl, label: PLAT_LABEL[pl], icon: ({ className }: { className?: string }) => <PlatformIcon platform={pl} className={className} />, disabled: !hasPlat(r, pl), hint: `No ${PLAT_LABEL[pl]} account` }));

function sideOf(r: PubCreatorRow, p: Plat, onPlat: (p: Plat) => void): VsSide {
  return {
    name: r.displayName, image: r.avatarUrl, href: `/creators/${r.slug}`,
    sub: `${r.rank !== null ? `Most Subscribed #${r.rank}` : "Not ranked"} \u00b7 ${asOfLabel(r.asOf) || "no date"}`,
    extra: <OptionButtons size="sm" label={`Platform for ${r.displayName}`} value={p} onChange={(id) => onPlat(id as Plat)} options={platOptions(r)} />,
  };
}

export function ComparePanel({ slugs, plats, onPlat, initial, onClose }: { slugs: string[]; plats: Record<string, Plat>; onPlat: (slug: string, p: Plat) => void; initial: PubCreatorRow[]; onClose: () => void }) {
  const [rows, setRows] = useState<PubCreatorRow[]>(initial.filter((r) => slugs.includes(r.slug) && r.growth));
  const [state, setState] = useState<"loading" | "ready" | "error">(rows.length === slugs.length ? "ready" : "loading");
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

  const shown = slugs.map((s) => rows.find((r) => r.slug === s)).filter(Boolean) as PubCreatorRow[];
  const [A, B] = shown;
  const pa = A ? (plats[A.slug] ?? firstPlatform(A)) : "youtube";
  const pb = B ? (plats[B.slug] ?? firstPlatform(B)) : "youtube";
  return (
    <VsDialog ariaLabel="Compare creators" state={state} onClose={onClose}
      left={A && B ? sideOf(A, pa, (p) => onPlat(A.slug, p)) : null} right={A && B ? sideOf(B, pb, (p) => onPlat(B.slug, p)) : null}
      rows={A && B ? rowsFor(A, pa, B, pb) : []}
      footer="Figures are each creator\u2019s last recorded values on the chosen platform. Gains compare each creator with their own earlier figures. Earnings are modeled estimates and the sponsorship is a hypothetical scenario, not reported income. \u201cNot available\u201d means no figure has been recorded, not zero." />
  );
}
