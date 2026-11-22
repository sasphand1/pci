"use client";

import { Link } from "@/fifi/router";
import { ArrowRight, Eye, HeartHandshake, Lightbulb, MapPinned, MessageCircle, ShieldCheck } from "lucide-react";

const fifiBoy = "/images/fifi/fifi-boy.webp";
import { openFifi } from "@/fifi/components/fifi-assistant";



export function AboutPage() {
  return (
    <main>
      <section className="bg-primary text-primary-foreground">
        <div className="site-container grid min-h-[480px] gap-8 py-14 lg:grid-cols-[1.25fr_.75fr] lg:items-center">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-soft">Why Fifi exists</p><h1 className="mt-5 max-w-3xl font-display text-5xl leading-[1.02] tracking-[-0.035em] sm:text-7xl">The internet should help you understand <em className="font-normal text-gold-soft">home.</em></h1><p className="mt-6 max-w-2xl text-base leading-7 text-primary-foreground/70 sm:text-lg">Fifi turns scattered information into useful context—connecting Pakistanis with the people, ideas, places and opportunities that make everyday life richer.</p></div>
          <div className="relative mx-auto flex h-52 w-52 items-center justify-center rounded-full border border-primary-foreground/15 bg-primary-light/30"><div className="absolute inset-4 rounded-full border border-dashed border-gold/40" /><img src={fifiBoy} alt="Fifi, a friendly digital companion" className="relative h-32 w-32 rounded-full object-cover shadow-soft" /><span className="absolute bottom-3 rounded-full bg-gold px-3.5 py-1.5 text-xs font-bold text-primary">Small guide. Big curiosity.</span></div>
        </div>
      </section>

      <div className="site-container">
        <section className="grid gap-10 border-b border-border py-14 lg:grid-cols-[.7fr_1.3fr]">
          <div><p className="eyebrow">From PCI to Fifi</p><h2 className="mt-3 font-display text-4xl text-primary">A bigger idea than a leaderboard.</h2></div>
          <div className="space-y-5 text-base leading-8 text-muted-foreground"><p>Fifi began as the <strong className="font-semibold text-foreground">Pakistan Creator Index</strong>, a way to make public information about digital creators easier to understand. But the same need exists far beyond creator rankings.</p><p>People want to know which events are worth attending, which neighbourhood businesses they can trust, what a trend really means and where to find an answer without wading through noise. Fifi brings those needs into one clear, welcoming platform.</p><p>Our long-term vision is a trusted Pakistani digital companion: part journal, part local guide, part community—and always focused on being genuinely useful.</p></div>
        </section>

        <section className="py-14">
          <div className="max-w-2xl"><p className="eyebrow">Our editorial compass</p><h2 className="mt-3 font-display text-4xl text-primary sm:text-5xl">Principles before page views.</h2></div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[
            { icon: Eye, title: "Clarity is a public service", text: "We explain what information means, where it came from and why it might matter to you." },
            { icon: ShieldCheck, title: "Trust must be earned", text: "We separate facts from promotion, acknowledge uncertainty and never hide the source behind a claim." },
            { icon: HeartHandshake, title: "Local value comes first", text: "We champion independent voices and businesses while keeping user interests ahead of advertisers." },
            { icon: Lightbulb, title: "Curiosity over outrage", text: "We make room for nuance, discovery and the stories that do not fit inside a trending topic." },
            { icon: MapPinned, title: "Pakistan is not one audience", text: "Different cities, languages and communities deserve representation, context and respect." },
            { icon: MessageCircle, title: "Technology should feel human", text: "Fifi will make information easier to explore through friendly text and voice—not more complicated." },
          ].map((item) => <article key={item.title} className="rounded-2xl border border-border bg-card p-6"><span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary"><item.icon className="h-5 w-5" /></span><h3 className="mt-5 font-display text-2xl text-primary">{item.title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{item.text}</p></article>)}</div>
        </section>

        <section className="rounded-2xl bg-gold-soft/65 p-6 sm:p-10">
          <div className="grid gap-8 lg:grid-cols-3"><div><p className="eyebrow">Where we're going</p><h2 className="mt-3 font-display text-3xl text-gold-foreground">Built in thoughtful steps.</h2></div><div className="space-y-6 lg:col-span-2">{[
            ["01", "Discover", "A unified creator index, city calendar, local guide and editorial journal."],
            ["02", "Participate", "Community contributions, useful recommendations and better ways to support local voices."],
            ["03", "Ask Fifi", "Source-backed text and voice assistance in familiar languages, designed around real needs."],
          ].map(([number, title, text]) => <div key={number} className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-gold-foreground/15 pb-5 last:border-0 last:pb-0"><span className="font-display text-xl text-gold-foreground/60">{number}</span><div><h3 className="font-semibold text-gold-foreground">{title}</h3><p className="mt-1 text-sm leading-6 text-gold-foreground/75">{text}</p></div></div>)}</div></div>
        </section>

        <section className="py-14 text-center"><p className="eyebrow">Start anywhere</p><h2 className="mx-auto mt-3 max-w-2xl font-display text-4xl leading-tight text-primary sm:text-5xl">There is always something worth discovering.</h2><div className="mt-7 flex flex-wrap justify-center gap-3"><Link to="/" className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground">Explore Fifi <ArrowRight className="h-4 w-4" /></Link><button type="button" onClick={openFifi} className="h-12 rounded-full border border-primary/20 px-6 text-sm font-semibold text-primary hover:bg-secondary">Ask Fifi a question</button></div></section>
      </div>
    </main>
  );
}
