"use client";

import { useMemo, useState } from "react";

import { ArrowUpRight, Check, Tv } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageIntro, SectionHeading } from "@/fifi/components/page-elements";
import { dramas } from "@/fifi/lib/fifi-extras";
import { cn } from "@/fifi/lib/utils";



export function DramasPage() {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [metric, setMetric] = useState<"viewsM" | "trp">("viewsM");
  const [selectedIds, setSelectedIds] = useState<[string, string]>(["kabhi-main-kabhi-tum", "jaafaa"]);

  const ranked = useMemo(() => {
    return [...dramas].sort((a, b) =>
      period === "week" ? b.weeklyViewsM - a.weeklyViewsM : b.monthlyViewsM - a.monthlyViewsM,
    );
  }, [period]);

  const dramaA = dramas.find((d) => d.id === selectedIds[0]) ?? dramas[0]!;
  const dramaB = dramas.find((d) => d.id === selectedIds[1]) ?? dramas[1]!;

  const comparisonData = useMemo(() => {
    return dramaA.series.map((point, index) => ({
      week: point.week,
      [dramaA.title]: metric === "viewsM" ? point.viewsM : point.trp,
      [dramaB.title]: metric === "viewsM" ? (dramaB.series[index]?.viewsM ?? 0) : (dramaB.series[index]?.trp ?? 0),
    }));
  }, [dramaA, dramaB, metric]);

  function pickDrama(id: string) {
    if (selectedIds[0] === id || selectedIds[1] === id) return;
    setSelectedIds([selectedIds[1], id]);
  }

  return (
    <main className="page-main pb-8">
      <PageIntro
        eyebrow="Television & YouTube Pulse"
        title="Pakistan's Top Dramas"
        description="Switch between this week and this month, then click any two dramas below to compare their viewership and TRP trajectories side by side."
      />

      <section className="content-card p-6 sm:p-8" aria-label="Side-by-side drama comparison">
        <div className="flex flex-col gap-4 border-b border-border/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Interactive Comparison</p>
            <h2 className="mt-1 font-display text-2xl font-medium tracking-tight text-primary sm:text-3xl">
              {dramaA.title} <span className="text-muted-foreground">vs.</span> {dramaB.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Click any drama card below to swap it into the comparison graph.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setMetric("viewsM")} className={cn("filter-pill h-9 px-3.5 text-xs", metric === "viewsM" && "filter-pill-active")}>
              YouTube Views (M)
            </button>
            <button type="button" onClick={() => setMetric("trp")} className={cn("filter-pill h-9 px-3.5 text-xs", metric === "trp" && "filter-pill-active")}>
              TV TRP Rating
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={comparisonData} margin={{ top: 10, right: 16, left: -8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} />
                <YAxis tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} unit={metric === "viewsM" ? "M" : ""} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    borderColor: "var(--color-border)",
                    borderRadius: "12px",
                    fontSize: "13px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "13px", paddingTop: "8px" }} />
                <Line type="monotone" dataKey={dramaA.title} stroke="var(--color-chart-1)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey={dramaB.title} stroke="var(--color-chart-2)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-3 self-center">
            {[dramaA, dramaB].map((item, idx) => (
              <div key={item.id} className="rounded-xl border border-border/80 bg-background/70 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <span className={cn("h-2.5 w-2.5 rounded-full", idx === 0 ? "bg-primary" : "bg-gold")} />
                    {item.network}
                  </span>
                  <span className="text-xs font-semibold text-primary">{item.weeklyChange} this week</span>
                </div>
                <h3 className="mt-1.5 font-display text-xl font-medium text-foreground">{item.title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.leadCast}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/70 pt-3 text-center">
                  <div>
                    <p className="text-sm font-bold text-primary">{item.weeklyViewsM}M</p>
                    <p className="text-[11px] text-muted-foreground">Weekly</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary">{item.monthlyViewsM}M</p>
                    <p className="text-[11px] text-muted-foreground">Monthly</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary">{item.trp}</p>
                    <p className="text-[11px] text-muted-foreground">TRP</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            eyebrow="Rankings"
            title={period === "week" ? "Top Dramas This Week" : "Top Dramas This Month"}
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setPeriod("week")} className={cn("filter-pill h-9 px-4 text-xs", period === "week" && "filter-pill-active")}>
              This Week
            </button>
            <button type="button" onClick={() => setPeriod("month")} className={cn("filter-pill h-9 px-4 text-xs", period === "month" && "filter-pill-active")}>
              This Month
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {ranked.map((drama, index) => {
            const isSelected = selectedIds.includes(drama.id);
            return (
              <button
                key={drama.id}
                type="button"
                onClick={() => pickDrama(drama.id)}
                className={cn(
                  "content-card group flex flex-col p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/40",
                  isSelected && "border-primary ring-2 ring-primary/15",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-secondary text-primary">#{index + 1}</span>
                    {drama.network}
                  </span>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold", isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-secondary group-hover:text-primary")}>
                    {isSelected ? <><Check className="h-3 w-3" /> Comparing</> : <><Tv className="h-3 w-3" /> Compare</>}
                  </span>
                </div>
                <h3 className="mt-3 font-display text-2xl font-medium text-foreground">{drama.title}</h3>
                <p className="mt-1 text-xs font-medium text-muted-foreground">{drama.leadCast} · {drama.genre}</p>
                <p className="mt-2.5 flex-1 text-sm leading-6 text-muted-foreground">{drama.summary}</p>
                <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3 text-xs">
                  <span className="font-semibold text-primary">
                    {period === "week" ? `${drama.weeklyViewsM}M weekly views` : `${drama.monthlyViewsM}M monthly views`}
                  </span>
                  <span className="inline-flex items-center gap-0.5 font-semibold text-gold-foreground">
                    {drama.weeklyChange} <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}