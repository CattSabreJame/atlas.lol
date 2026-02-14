"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Eye, MousePointerClick, Sparkles, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { ensureHandlePrefix } from "@/lib/handles";
import { formatCompactNumber, formatDayLabel, toPublicProfileUrl } from "@/lib/utils";
import { AnalyticsDailyRow, LinkRow } from "@/types/db";

interface DashboardClientProps {
  handle: string;
  analyticsRows: AnalyticsDailyRow[];
  links: LinkRow[];
  commentsCount: number;
  tracksCount: number;
  widgetsCount: number;
}

function getRangeDays(length: number, offset = 0): string[] {
  const result: string[] = [];
  const now = new Date();

  for (let index = length - 1 + offset; index >= offset; index -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - index);
    result.push(day.toISOString().slice(0, 10));
  }

  return result;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}

function sectionMotion(delay: number, reduceMotion: boolean | null) {
  if (reduceMotion) {
    return {};
  }

  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.24, delay, ease: "easeOut" as const },
  };
}

export function DashboardClient({
  handle,
  analyticsRows,
  links,
  commentsCount,
  tracksCount,
  widgetsCount,
}: DashboardClientProps) {
  const [range, setRange] = useState<7 | 30>(7);
  const reduceMotion = useReducedMotion();

  const viewsByDay = useMemo(() => new Map(analyticsRows.map((row) => [row.day, row.profile_views])), [analyticsRows]);

  const chartRows = useMemo(
    () =>
      getRangeDays(range).map((day) => ({
        day,
        views: viewsByDay.get(day) ?? 0,
      })),
    [range, viewsByDay],
  );

  const previousRangeRows = useMemo(
    () =>
      getRangeDays(range, range).map((day) => ({
        day,
        views: viewsByDay.get(day) ?? 0,
      })),
    [range, viewsByDay],
  );

  const rangeViews = useMemo(() => chartRows.reduce((sum, row) => sum + row.views, 0), [chartRows]);
  const previousRangeViews = useMemo(
    () => previousRangeRows.reduce((sum, row) => sum + row.views, 0),
    [previousRangeRows],
  );
  const totalClicks = useMemo(() => links.reduce((sum, row) => sum + row.clicks, 0), [links]);
  const topLinks = useMemo(() => [...links].sort((a, b) => b.clicks - a.clicks).slice(0, 7), [links]);
  const maxViews = Math.max(...chartRows.map((row) => row.views), 1);
  const maxClicks = Math.max(...topLinks.map((row) => row.clicks), 1);

  const growthPercent =
    previousRangeViews > 0
      ? ((rangeViews - previousRangeViews) / previousRangeViews) * 100
      : rangeViews > 0
        ? 100
        : 0;

  const clickThroughRate = rangeViews > 0 ? (totalClicks / rangeViews) * 100 : 0;
  const averageViewsPerDay = range > 0 ? rangeViews / range : 0;
  const averageClicksPerLink = links.length > 0 ? totalClicks / links.length : 0;
  const clickedLinksCount = links.filter((link) => link.clicks > 0).length;
  const linkActivationRate = links.length ? (clickedLinksCount / links.length) * 100 : 0;
  const activeDays = chartRows.filter((row) => row.views > 0).length;

  const bestDay = chartRows.reduce(
    (best, row) => (row.views > best.views ? row : best),
    chartRows[0] ?? { day: "", views: 0 },
  );

  return (
    <div className="space-y-5 pb-12">
      <motion.section className="panel p-7 sm:p-8" {...sectionMotion(0, reduceMotion)}>
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="section-kicker">Dashboard</p>
            <h1 className="mt-3 text-[clamp(2rem,4vw,2.75rem)] leading-[1.06] font-semibold tracking-tight text-white">
              Performance overview
            </h1>
            <p className="mt-2 max-w-[56ch] text-sm text-[#b6ada0]">
              Calm analytics for creator growth, with cleaner hierarchy and less noise.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="segmented">
              <button className="segmented-btn" data-active={range === 7} onClick={() => setRange(7)} type="button">
                7d
              </button>
              <button className="segmented-btn" data-active={range === 30} onClick={() => setRange(30)} type="button">
                30d
              </button>
            </div>
            <Link
              href={toPublicProfileUrl(handle)}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary inline-flex items-center gap-2"
            >
              {ensureHandlePrefix(handle)}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="surface-soft px-4 py-4">
            <p className="section-kicker inline-flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Views ({range}d)
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">{formatCompactNumber(rangeViews)}</p>
            <p className="mt-1 text-xs text-[#9f9588]">{activeDays} active day{activeDays === 1 ? "" : "s"}</p>
          </div>

          <div className="surface-soft px-4 py-4">
            <p className="section-kicker inline-flex items-center gap-1.5">
              <MousePointerClick className="h-3.5 w-3.5" />
              Total clicks
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">{formatCompactNumber(totalClicks)}</p>
            <p className="mt-1 text-xs text-[#9f9588]">{formatPercent(clickThroughRate)} CTR</p>
          </div>

          <div className="surface-soft px-4 py-4">
            <p className="section-kicker inline-flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Trend vs prior
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">{growthPercent >= 0 ? "+" : ""}{growthPercent.toFixed(1)}%</p>
            <p className="mt-1 text-xs text-[#9f9588]">Compared with previous {range} days</p>
          </div>

          <div className="surface-soft px-4 py-4">
            <p className="section-kicker inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Content health
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">{formatCompactNumber(links.length)}</p>
            <p className="mt-1 text-xs text-[#9f9588]">Links with {tracksCount} tracks and {widgetsCount} widgets</p>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
        <motion.section className="panel p-6" {...sectionMotion(0.05, reduceMotion)}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">Profile views trend</h2>
            <span className="text-xs text-[#a69d8f]">Last {range} days</span>
          </div>

          <div className="space-y-2.5">
            {chartRows.map((row) => (
              <div key={row.day} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-[#b4ab9d]">
                  <span>{formatDayLabel(row.day)}</span>
                  <span>{row.views}</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/8">
                  <div
                    className="h-2.5 rounded-full"
                    style={{
                      width: `${Math.max((row.views / maxViews) * 100, row.views > 0 ? 5 : 0)}%`,
                      background:
                        "linear-gradient(90deg, color-mix(in srgb, var(--accent) 76%, #655c51), var(--accent-strong))",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section className="panel p-6" {...sectionMotion(0.09, reduceMotion)}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">Most clicked links</h2>
            <Link href="/editor" className="text-xs text-[var(--accent-strong)] hover:underline">
              Manage
            </Link>
          </div>

          {topLinks.length ? (
            <div className="space-y-3">
              {topLinks.map((link) => (
                <div key={link.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-[#ddd6cc]">{link.title}</span>
                    <span className="text-[#aa9f91]">{link.clicks}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/8">
                    <div
                      className="h-2.5 rounded-full bg-[#8e826f]"
                      style={{ width: `${Math.max((link.clicks / maxClicks) * 100, link.clicks > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-[#aaa193]">
              No links yet. Add and publish links in the editor.
            </p>
          )}
        </motion.section>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <motion.section className="panel p-5" {...sectionMotion(0.12, reduceMotion)}>
          <p className="section-kicker">Insights</p>
          <div className="mt-3 space-y-2.5">
            <div className="surface-soft px-3 py-2">
              <p className="text-xs text-[#a89f92]">Best day</p>
              <p className="mt-1 text-sm text-white">
                {bestDay.day ? `${formatDayLabel(bestDay.day)} - ${bestDay.views} views` : "No view data yet"}
              </p>
            </div>
            <div className="surface-soft px-3 py-2">
              <p className="text-xs text-[#a89f92]">Average views / day</p>
              <p className="mt-1 text-lg font-semibold text-white">{averageViewsPerDay.toFixed(1)}</p>
            </div>
            <div className="surface-soft px-3 py-2">
              <p className="text-xs text-[#a89f92]">Average clicks / link</p>
              <p className="mt-1 text-lg font-semibold text-white">{averageClicksPerLink.toFixed(1)}</p>
            </div>
          </div>
        </motion.section>

        <motion.section className="panel p-5" {...sectionMotion(0.15, reduceMotion)}>
          <p className="section-kicker">Audience</p>
          <div className="mt-3 space-y-2.5">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
              <span className="text-[#b6ab9d]">Comments</span>
              <span className="font-medium text-white">{formatCompactNumber(commentsCount)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
              <span className="text-[#b6ab9d]">Link activation rate</span>
              <span className="font-medium text-white">{formatPercent(linkActivationRate)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
              <span className="text-[#b6ab9d]">Published links</span>
              <span className="font-medium text-white">{links.length}</span>
            </div>
          </div>
        </motion.section>

        <motion.section className="panel p-5" {...sectionMotion(0.18, reduceMotion)}>
          <p className="section-kicker">Build Status</p>
          <div className="mt-3 space-y-2.5 text-sm">
            <div className="surface-soft px-3 py-2">
              <p className="text-xs text-[#a89f92]">Music tracks</p>
              <p className="mt-1 text-white">{tracksCount} active setup{tracksCount === 1 ? "" : "s"}</p>
            </div>
            <div className="surface-soft px-3 py-2">
              <p className="text-xs text-[#a89f92]">Widgets</p>
              <p className="mt-1 text-white">{widgetsCount} widget{widgetsCount === 1 ? "" : "s"}</p>
            </div>
            <div className="surface-soft px-3 py-2">
              <p className="text-xs text-[#a89f92]">Quick suggestion</p>
              <p className="mt-1 text-white">
                {links.length < 3
                  ? "Add at least 3 links to improve profile depth."
                  : growthPercent < 0
                    ? "Refresh top links and bio copy to recover momentum."
                    : "Keep this structure and test new link copy in AI Assist."}
              </p>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
