"use client";

import { useState, type FormEvent } from "react";
import { ExternalLink, MapPin, Send, ShieldCheck, Star } from "lucide-react";

const fifiBoy = "/images/fifi/fifi-boy.webp";
import { businesses } from "@/fifi/lib/fifi-data";
import { cn } from "@/fifi/lib/utils";

const quickPrompts = ["Show me cafés in Lahore", "Top dramas this week", "Upcoming food events"];

const defaultPicks = [
  {
    rank: 1,
    name: "Food Street (Fort Road)",
    location: "Walled City, Lahore",
    rating: "4.6",
    reviews: "4.2k reviews",
    why: "Iconic street food spot with legendary BBQ, nihari and traditional Lahori flavours.",
    image: businesses[0]?.image ?? "",
  },
  {
    rank: 2,
    name: "Nisa Sultan",
    location: "MM Alam Road, Lahore",
    rating: "4.6",
    reviews: "1.8k reviews",
    why: "Renowned for authentic nihari, paya and traditional Lahori cuisine.",
    image: businesses[1]?.image ?? "",
  },
  {
    rank: 3,
    name: "Haveli Restaurant",
    location: "Gulberg, Lahore",
    rating: "4.4",
    reviews: "2.1k reviews",
    why: "Traditional Punjabi food with a cultural dining experience.",
    image: businesses[2]?.image ?? "",
  },
];

const defaultSources = [
  "Dawn — Best Food Places in Lahore (2026)",
  "Time Out Pakistan — Lahore Food Guide",
  "Google Maps — Top Rated Restaurants in Lahore",
];

function replyFor(q: string) {
  const v = q.toLowerCase();
  if (v.includes("drama") || v.includes("tv")) {
    return "Kabhi Main Kabhi Tum leads this week with 28.4M YouTube views and 14.2 TRP, followed by Jafaa (21.8M) and Iqtidar (19.6M). Open the Dramas page to compare any two shows on a live graph.";
  }
  if (v.includes("event") || v.includes("weekend")) {
    return "Top metro events this week include the Karachi Food Festival (28 Nov), Coke Studio Live in Lahore (29 Nov), and Lok Virsa Craft Bazaar in Islamabad (4 Dec).";
  }
  if (v.includes("satellite") || v.includes("solar") || v.includes("farm")) {
    return "Punjab wheat vigor is tracking +8% above its 5-year baseline, Sindh leads rooftop solar at 5.6 kWh/kWp/day, and Islamabad AQI sits at 78.";
  }
  return "Here are the top verified local recommendations based on public ratings, editorial guides and community reviews:";
}

export function FifiAssistant({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("Hey Fifi, can you suggest the best places for Lahore food? I'm looking for authentic local recommendations.");
  const [answer, setAnswer] = useState("Lahore is a food lover's paradise. Here are some of the best places for authentic Lahore food, based on verified local sources and popular reviews:");

  function ask(value: string) {
    const clean = value.trim();
    if (!clean) return;
    setAsked(clean);
    setAnswer(replyFor(clean));
    setQuestion("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    ask(question);
  }

  return (
    <section id="ask-fifi" className={cn("flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft", className)} aria-label="Fifi AI assistant">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <img src={fifiBoy} alt="Fifi AI" className="h-10 w-10 shrink-0 rounded-full border border-primary/15 object-cover" />
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold tracking-tight text-primary">Fifi AI</h2>
              <span className="rounded-md bg-gold px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">Beta</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Your Pakistan guide, powered by real sources.</p>
          </div>
        </div>
        <span className="hidden items-center gap-1 rounded-full border border-primary/15 bg-secondary/70 px-2.5 py-1 text-[10px] font-semibold text-primary sm:inline-flex">
          <ShieldCheck className="h-3 w-3" /> Trusted & Source-Backed
        </span>
      </div>

      <div className="flex-1 space-y-3.5 p-4">
        <div className="ml-6 rounded-2xl rounded-tr-sm bg-secondary/70 px-3.5 py-2.5 text-xs leading-5 text-foreground">
          {asked}
        </div>

        <div className="flex items-start gap-2.5">
          <img src={fifiBoy} alt="" className="mt-0.5 h-7 w-7 shrink-0 rounded-full object-cover" />
          <p className="text-xs leading-5 text-foreground/90">{answer}</p>
        </div>

        {!compact && (
          <>
            <div className="space-y-2.5">
              {defaultPicks.map((pick) => (
                <div key={pick.rank} className="rounded-xl border border-border/70 bg-background/50 p-2.5">
                  <div className="flex gap-3">
                    <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                      <img src={pick.image} alt={pick.name} className="h-full w-full object-cover" />
                      <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-gold text-[10px] font-bold text-primary-foreground">
                        {pick.rank}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-xs font-bold text-foreground">{pick.name}</h3>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" /> {pick.location}
                          </p>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-semibold text-primary">
                          Maps <ExternalLink className="h-2.5 w-2.5" />
                        </span>
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-gold-foreground">
                        <Star className="h-3 w-3 fill-gold text-gold" /> {pick.rating} <span className="font-normal text-muted-foreground">({pick.reviews})</span>
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 rounded-lg bg-secondary/45 px-2.5 py-1.5 text-[11px] leading-4 text-muted-foreground">
                    <strong className="font-semibold text-foreground">Why famous:</strong> {pick.why}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border/70 bg-background/50 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-primary">
                <ShieldCheck className="h-3.5 w-3.5" /> Sources
              </p>
              <ol className="mt-2 space-y-1.5">
                {defaultSources.map((src, i) => (
                  <li key={src} className="flex items-center gap-2 text-[11px] text-primary">
                    <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-gold-soft text-[9px] font-bold text-gold-foreground">{i + 1}</span>
                    <span className="truncate underline decoration-primary/30 underline-offset-2">{src}</span>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}
      </div>

      <div className="border-t border-border/70 bg-background/60 p-3.5">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => ask(prompt)}
              className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-primary/30 hover:text-primary"
            >
              {prompt}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex items-center gap-2 rounded-full border border-input bg-card py-1.5 pl-4 pr-1.5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
          <label htmlFor={compact ? "fifi-question-dialog" : "fifi-question"} className="sr-only">Ask Fifi anything about Pakistan</label>
          <input
            id={compact ? "fifi-question-dialog" : "fifi-question"}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask Fifi anything about Pakistan…"
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
          <button type="submit" aria-label="Send question" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition hover:bg-primary-light disabled:opacity-40" disabled={!question.trim()}>
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </section>
  );
}

export function openFifi() {
  window.dispatchEvent(new CustomEvent("fifi:open"));
}