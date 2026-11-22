"use client";

import { useMemo, useState } from "react";

import { ArrowRight, BookOpen, CheckCircle2, FileSearch, Scale } from "lucide-react";

import { PageIntro, SaveButton } from "@/fifi/components/page-elements";
import { openFifi } from "@/fifi/components/fifi-assistant";
import { stories } from "@/fifi/lib/fifi-data";
import { cn } from "@/fifi/lib/utils";



export function InsightsPage() {
  const [category, setCategory] = useState("All stories");
  const categories = ["All stories", ...Array.from(new Set(stories.map((story) => story.category)))];
  const visible = useMemo(() => category === "All stories" ? stories : stories.filter((story) => story.category === category), [category]);
  const featured = stories[0]!;

  return (
    <main className="page-main">
      <PageIntro eyebrow="The Fifi journal" title="Context is the real story." description="Clear, useful writing about digital culture, local life and the numbers behind the headlines—so you can understand what matters, not just what's popular." aside={<button type="button" onClick={openFifi} className="inline-flex h-11 items-center gap-2 rounded-full border border-primary/20 bg-card px-5 text-sm font-semibold text-primary hover:bg-secondary">Ask Fifi to explain <ArrowRight className="h-4 w-4" /></button>} />

      <section className="py-8 sm:py-10">
        <article className="grid overflow-hidden rounded-2xl border border-border bg-card shadow-soft lg:grid-cols-2">
          <div className="relative min-h-80 overflow-hidden"><img src={featured.image} alt="A colourful Pakistani meal shared at a table" className="absolute inset-0 h-full w-full object-cover" /><span className="absolute left-5 top-5 rounded-full bg-gold px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Cover story</span></div>
          <div className="flex flex-col justify-center p-6 sm:p-10"><p className="eyebrow">{featured.category} · {featured.readTime}</p><h2 className="mt-4 font-display text-4xl leading-[1.08] tracking-tight text-primary sm:text-5xl">{featured.title}</h2><p className="mt-5 text-sm leading-7 text-muted-foreground sm:text-base">{featured.excerpt} We look at the creators making food content feel more rooted, more generous and more useful.</p><div className="mt-6 flex items-center gap-3 border-t border-border pt-5 text-xs text-muted-foreground"><span className="grid h-9 w-9 place-items-center rounded-full bg-secondary font-display text-lg text-primary">F</span><span>Fifi Editorial<br /><span className="text-muted-foreground/80">{featured.date}</span></span></div></div>
        </article>
      </section>

      <section className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3" aria-label="Our editorial standards">
        {[{ icon: FileSearch, title: "Sources before claims", text: "We show where information comes from and what its limits are." }, { icon: Scale, title: "Context before rankings", text: "Numbers help only when you understand what they actually measure." }, { icon: CheckCircle2, title: "Useful before viral", text: "We choose clarity and public value over empty engagement." }].map((item) => <div key={item.title} className="bg-card p-5 sm:p-6"><item.icon className="h-5 w-5 text-gold" /><h3 className="mt-3 text-sm font-semibold text-primary">{item.title}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.text}</p></div>)}
      </section>

      <section className="py-10 sm:py-14">
        <div className="mb-7 flex flex-col gap-5 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Ideas, guides & explainers</p><h2 className="mt-2 font-display text-3xl text-primary sm:text-4xl">The latest reading</h2></div><div className="flex max-w-full gap-2 overflow-x-auto pb-1">{categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={cn("shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition", category === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-primary")}>{item}</button>)}</div></div>
        <div className="grid gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-3">{visible.map((story) => (
          <article key={story.id} className="group flex flex-col"><div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted"><img src={story.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute right-3 top-3"><SaveButton label={story.title} /></div></div><p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-gold-foreground">{story.category}</p><h3 className="mt-2 font-display text-2xl leading-tight text-primary">{story.title}</h3><p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{story.excerpt}</p><p className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><BookOpen className="h-3.5 w-3.5" />{story.readTime}<span>·</span>{story.date}</p></article>
        ))}</div>
      </section>
    </main>
  );
}
