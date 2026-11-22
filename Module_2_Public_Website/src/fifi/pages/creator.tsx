"use client";

import { Link } from "@/fifi/router";
import { ArrowLeft, MapPin, TrendingUp, Users } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { FollowButton, Pic } from "@/fifi/components/page-elements";
import type { RealCreator } from "@/fifi/lib/real";



export type CreatorProfileProps = {
  creator: RealCreator;
  rank: string; // best published position, or "Not ranked"
  series: { month: string; reachK: number }[]; // real subscriber history, may be empty
  peers: RealCreator[];
  accounts: { platform: string; handle: string; url: string | null; followers: string; views: string; posts30d: string; asOf: string }[];
};

export function CreatorProfilePage({ creator, rank, series: growthSeries, peers, accounts }: CreatorProfileProps) {
  return (
    <main className="page-main pb-8 pt-6 sm:pt-8">
      <Link to="/creators" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to Creator Index
      </Link>

      <section className="content-card mt-4 p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <Pic src={creator.image} alt={creator.name} className="h-20 w-20 rounded-2xl object-cover shadow-soft" />
            <div>
              <p className="eyebrow">{creator.category} · Public Profile</p>
              <h1 className="mt-1 font-display text-3xl font-medium text-primary sm:text-4xl">{creator.name}</h1>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <span>{creator.handle}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {creator.city}</span>
              </p>
            </div>
          </div>
          <FollowButton name={creator.name} />
        </div>

        {creator.bio && <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{creator.bio}</p>}

        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-border/80 pt-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Audience</p>
            <p className="mt-1 font-display text-3xl font-semibold text-primary">{creator.followers}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">30-Day Growth</p>
            <p className="mt-1 inline-flex items-center gap-1 font-display text-3xl font-semibold text-gold-foreground">
              <TrendingUp className="h-5 w-5" /> {creator.growth}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Index Rank</p>
            <p className="mt-1 font-display text-3xl font-semibold text-foreground">{rank}</p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.45fr_0.95fr]">
        <div className="content-card p-6">
          <p className="eyebrow">Observed History</p>
          <h2 className="mt-1 font-display text-2xl font-medium text-primary">Subscriber and follower trend</h2>
          <div className="mt-5 h-[260px] w-full">
            {growthSeries.length < 2 ? <p className="grid h-full place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">Not enough observations to draw a trend yet.</p> : <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthSeries} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} />
                <YAxis tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} unit="K" />
                <Tooltip contentStyle={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)", borderRadius: "12px", fontSize: "13px" }} />
                <Area type="monotone" dataKey="reachK" name="Reach (K)" stroke="var(--color-chart-1)" fill="var(--color-sage)" fillOpacity={0.7} strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>}
          </div>
        </div>

        <div className="content-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-medium text-primary">Compare Peers</h2>
            <Users className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-4 divide-y divide-border/70">
            {peers.map((peer) => (
              <Link key={peer.id} to="/creators/$id" params={{ id: peer.slug ?? String(peer.id) }} className="group flex items-center gap-3 py-3">
                <Pic src={peer.image} alt={peer.name} className="h-10 w-10 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">{peer.name}</p>
                  <p className="text-xs text-muted-foreground">{peer.category} · {peer.city}</p>
                </div>
                <span className="text-xs font-bold text-primary">{peer.followers}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="content-card mt-6 p-6">
        <p className="eyebrow">Accounts</p>
        <h2 className="mt-1 font-display text-2xl font-medium text-primary">Linked public accounts</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <th scope="col" className="border-b border-border py-3 pr-4">Platform</th><th scope="col" className="border-b border-border py-3 pr-4">Account</th><th scope="col" className="border-b border-border py-3 pr-4 text-right">Followers</th><th scope="col" className="border-b border-border py-3 pr-4 text-right">Lifetime views</th><th scope="col" className="border-b border-border py-3 pr-4 text-right">Posts, 30 days</th><th scope="col" className="border-b border-border py-3">As of</th>
            </tr></thead>
            <tbody>{accounts.map((account) => (
              <tr key={account.platform + account.handle}>
                <td className="border-b border-border/70 py-3 pr-4">{account.platform}</td>
                <td className="border-b border-border/70 py-3 pr-4">{account.url ? <a className="font-semibold text-primary hover:underline" href={account.url} target="_blank" rel="noopener noreferrer">{account.handle} ↗</a> : account.handle}</td>
                <td className="border-b border-border/70 py-3 pr-4 text-right tabular-nums">{account.followers}</td>
                <td className="border-b border-border/70 py-3 pr-4 text-right tabular-nums">{account.views}</td>
                <td className="border-b border-border/70 py-3 pr-4 text-right tabular-nums">{account.posts30d}</td>
                <td className="border-b border-border/70 py-3">{account.asOf}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="mt-3 max-w-3xl text-xs text-muted-foreground">These are the numbers the platforms report. A number older than 7 days is shown as not available rather than as zero. YouTube subscriber counts are rounded by YouTube.</p>
      </section>
    </main>
  );
}