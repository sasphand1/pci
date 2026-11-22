"use client";

import { useState } from "react";

import { CheckCircle2, Database, RefreshCw, Shield, SlidersHorizontal, Users } from "lucide-react";
import { toast } from "sonner";

import { PageIntro } from "@/fifi/components/page-elements";
import { cn } from "@/fifi/lib/utils";



type Pipeline = {
  id: string;
  name: string;
  source: string;
  status: "Healthy" | "Syncing" | "Needs review";
  records: string;
  lastRun: string;
};

const initialPipelines: Pipeline[] = [
  { id: "creators", name: "Creator Index Snapshot", source: "Public YouTube & Social APIs", status: "Healthy", records: "1,420 profiles", lastRun: "14 mins ago" },
  { id: "dramas", name: "Drama Viewership & TRP Feed", source: "YouTube Channels + Broadcast Logs", status: "Healthy", records: "68 active series", lastRun: "28 mins ago" },
  { id: "satellite", name: "Sentinel-2 Earth Observation", source: "Copernicus & PMD Baselines", status: "Healthy", records: "4 regional indices", lastRun: "2 hours ago" },
  { id: "events", name: "City Events & Local Directory", source: "Curated Submissions Queue", status: "Needs review", records: "12 pending items", lastRun: "5 mins ago" },
];

const initialQueue = [
  { id: 1, title: "Lahore Literature Festival 2026", type: "Event", city: "Lahore", submittedBy: "Editorial Desk" },
  { id: 2, title: "Bilal Munir (@bilalbuilds)", type: "Creator Verification", city: "Karachi", submittedBy: "Index Pipeline" },
  { id: 3, title: "Qarz-e-Jaan Episode 11 Metrics", type: "Drama Data", city: "National", submittedBy: "YouTube Sync" },
];

export function AdminPage() {
  const [pipelines, setPipelines] = useState(initialPipelines);
  const [queue, setQueue] = useState(initialQueue);
  const [tab, setTab] = useState<"pipelines" | "moderation">("pipelines");

  function syncPipeline(id: string) {
    setPipelines((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: "Healthy", lastRun: "Just now" } : item)),
    );
    toast.success("Pipeline sync queued (preview mode)");
  }

  function resolveItem(id: number, action: "Approved" | "Dismissed") {
    setQueue((prev) => prev.filter((item) => item.id !== id));
    toast.success(`${action} submission`);
  }

  return (
    <main className="page-main pb-8">
      <PageIntro
        eyebrow="Operations Console"
        title="Data & Platform Admin"
        description="Monitor public data ingestion pipelines, verify creator and drama snapshots, and moderate local submissions. Ready to wire to your live backend API."
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Admin metrics">
        {[
          { label: "Active Pipelines", value: "4 / 4", icon: Database },
          { label: "Indexed Creators", value: "1,420", icon: Users },
          { label: "Pending Moderation", value: String(queue.length), icon: Shield },
          { label: "API Readiness", value: "OpenAPI v1", icon: SlidersHorizontal },
        ].map((stat) => (
          <div key={stat.label} className="content-card p-5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">{stat.label}</span>
              <stat.icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 font-display text-3xl font-semibold text-primary">{stat.value}</p>
          </div>
        ))}
      </section>

      <div className="mt-8 flex gap-2">
        <button type="button" onClick={() => setTab("pipelines")} className={cn("filter-pill", tab === "pipelines" && "filter-pill-active")}>
          Data Pipelines
        </button>
        <button type="button" onClick={() => setTab("moderation")} className={cn("filter-pill", tab === "moderation" && "filter-pill-active")}>
          Moderation Queue ({queue.length})
        </button>
      </div>

      {tab === "pipelines" ? (
        <section className="content-card mt-5 divide-y divide-border/80 overflow-hidden">
          {pipelines.map((pipe) => (
            <div key={pipe.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="font-semibold text-foreground">{pipe.name}</h2>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", pipe.status === "Healthy" ? "bg-secondary text-primary" : "bg-gold-soft text-gold-foreground")}>
                    {pipe.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{pipe.source} · {pipe.records} · Updated {pipe.lastRun}</p>
              </div>
              <button
                type="button"
                onClick={() => syncPipeline(pipe.id)}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border bg-background px-4 text-xs font-semibold text-primary transition hover:border-primary/35 hover:bg-secondary"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Run Sync
              </button>
            </div>
          ))}
        </section>
      ) : (
        <section className="content-card mt-5 divide-y divide-border/80 overflow-hidden">
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-8 w-8 text-primary" />
              <p className="mt-2 font-display text-xl text-primary">Queue is clear</p>
              <p className="mt-1 text-xs text-muted-foreground">All pending items have been reviewed.</p>
            </div>
          ) : (
            queue.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gold-foreground">{item.type} · {item.city}</p>
                  <h2 className="mt-0.5 font-semibold text-foreground">{item.title}</h2>
                  <p className="text-xs text-muted-foreground">Submitted by {item.submittedBy}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => resolveItem(item.id, "Approved")} className="h-9 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary-light">
                    Approve
                  </button>
                  <button type="button" onClick={() => resolveItem(item.id, "Dismissed")} className="h-9 rounded-full border border-border px-4 text-xs font-semibold text-muted-foreground transition hover:bg-muted">
                    Dismiss
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      )}
    </main>
  );
}