"use client";

import { useState } from "react";

import { CloudRain, Leaf, Sun, Wind } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { PageIntro } from "@/fifi/components/page-elements";
import { satelliteModules, satelliteRegions, type SatelliteModuleId } from "@/fifi/lib/fifi-extras";
import { cn } from "@/fifi/lib/utils";



const icons: Record<SatelliteModuleId, typeof Leaf> = {
  farm: Leaf,
  water: CloudRain,
  solar: Sun,
  city: Wind,
};

export function SatellitePage() {
  const [activeId, setActiveId] = useState<SatelliteModuleId>("farm");
  const [region, setRegion] = useState<(typeof satelliteRegions)[number]>("Punjab");

  const module = satelliteModules.find((item) => item.id === activeId) ?? satelliteModules[0]!;
  const data = module.regions[region] ?? module.regions["Punjab"]!;

  return (
    <main className="page-main pb-8">
      <PageIntro
        eyebrow="Earth Observation for Everyday Decisions"
        title="Satellite Intelligence"
        description="Public satellite imagery translated into clear, practical guidance for crops, water storage, rooftop solar and city air quality across Pakistan."
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Satellite modules">
          {satelliteModules.map((item) => {
            const Icon = icons[item.id];
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveId(item.id)}
                className={cn("filter-pill gap-2", active && "filter-pill-active")}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-1.5" aria-label="Select region">
          {satelliteRegions.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRegion(item)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                region === item
                  ? "border-gold bg-gold-soft text-gold-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-primary",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.45fr_0.95fr]">
        <div className="content-card p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">{module.label} · {region}</p>
              <h2 className="mt-1 font-display text-2xl font-medium text-primary sm:text-3xl">{module.headline}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{module.summary}</p>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
              {data.status}
            </span>
          </div>

          <div className="mt-6 h-[290px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} />
                <YAxis tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    borderColor: "var(--color-border)",
                    borderRadius: "12px",
                    fontSize: "13px",
                  }}
                />
                <Area type="monotone" dataKey="baseline" name="5-yr Baseline" stroke="var(--color-chart-2)" fill="var(--color-gold-soft)" fillOpacity={0.45} strokeWidth={2} />
                <Area type="monotone" dataKey="value" name={module.metricUnit} stroke="var(--color-chart-1)" fill="var(--color-sage)" fillOpacity={0.7} strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="content-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{data.indexLabel}</p>
              <p className="mt-2 font-display text-4xl font-semibold text-primary">{data.indexValue}</p>
            </div>
            <div className="content-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{data.secondaryLabel}</p>
              <p className="mt-2 font-display text-2xl font-semibold text-gold-foreground">{data.secondaryValue}</p>
            </div>
          </div>

          <div className="content-card flex-1 p-6">
            <p className="eyebrow">Plain-Language Brief</p>
            <h3 className="mt-1.5 font-display text-xl font-medium text-foreground">What this means for {region}</h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{data.advisory}</p>
            <p className="mt-4 border-t border-border/70 pt-3 text-xs text-muted-foreground">
              Preview dataset modeled on Copernicus Sentinel-2 & regional meteorological baselines.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}