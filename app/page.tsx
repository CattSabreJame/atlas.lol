"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Crown,
  LayoutPanelTop,
  MousePointer2,
  Sparkles,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { type ReactNode } from "react";

import { PageTransition } from "@/components/ui/page-transition";
import { cn } from "@/lib/utils";

interface FeatureItem {
  title: string;
  sentence: string;
  icon: LucideIcon;
  kicker: string;
}

interface PlanListItem {
  label: string;
}

interface UpgradeStep {
  title: string;
  sentence: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface SectionIntroProps {
  eyebrow: string;
  title: string;
  sentence: string;
  className?: string;
}

interface RevealProps {
  id?: string;
  className?: string;
  delay?: number;
  children: ReactNode;
}

const PREMIUM_TICKET_URL =
  process.env.NEXT_PUBLIC_DISCORD_PREMIUM_TICKET_URL
  ?? process.env.NEXT_PUBLIC_DISCORD_APPEAL_URL
  ?? "https://discord.gg/";

const NAV_ITEMS = [
  { label: "Product", href: "#product" },
  { label: "Pro", href: "#pro" },
  { label: "Compare", href: "#compare" },
  { label: "Docs", href: "/docs" },
];

const CORE_FEATURES: FeatureItem[] = [
  {
    title: "Profile Editor",
    sentence: "Build your public page with links, widgets, music, entry screen, and full visual controls.",
    icon: LayoutPanelTop,
    kicker: "Starter Included",
  },
  {
    title: "Live Publishing",
    sentence: "Save once and update your public page instantly with a private/public visibility toggle.",
    icon: Sparkles,
    kicker: "Starter Included",
  },
  {
    title: "Analytics",
    sentence: "Track profile views and link clicks from a focused dashboard built for iteration.",
    icon: CheckCircle2,
    kicker: "Starter Included",
  },
];

const PRO_FEATURES: FeatureItem[] = [
  {
    title: "AI Assist",
    sentence: "Bio Generator, Link Label Helper, and Bio Polish directly inside the editor.",
    icon: WandSparkles,
    kicker: "Pro Only",
  },
  {
    title: "Cursor Studio",
    sentence: "Upload and activate custom cursors and cursor trail styles for your profile experience.",
    icon: MousePointer2,
    kicker: "Pro Only",
  },
];

const FREE_PLAN_LIST: PlanListItem[] = [
  { label: "Full profile editor" },
  { label: "Media backgrounds and effects" },
  { label: "Entry screen and custom fonts" },
  { label: "Profile and link effects" },
  { label: "Analytics dashboard" },
  { label: "Music and widgets" },
];

const PRO_PLAN_LIST: PlanListItem[] = [
  { label: "AI Assist tools" },
  { label: "Cursor Studio uploads" },
  { label: "Active custom cursor support" },
  { label: "Lifetime access (one-time payment)" },
];

const UPGRADE_STEPS: UpgradeStep[] = [
  {
    title: "Open a ticket",
    sentence: "Use the Pro buy button or `/premium` command to open the Discord ticket flow.",
  },
  {
    title: "Pay once",
    sentence: "Pro is a one-time $10 lifetime plan via Venmo, PayPal, or Cash App.",
  },
  {
    title: "Get activated",
    sentence: "Staff grants your Pro badge and you can use AI Assist and Cursor Studio immediately.",
  },
];

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "How much is Pro?",
    answer: "Pro is $10 one-time for lifetime access.",
  },
  {
    question: "What features are Pro-only?",
    answer: "AI Assist and Cursor Studio (custom cursor uploads and activation).",
  },
  {
    question: "Do I lose normal customization without Pro?",
    answer: "No. Core profile visuals, backgrounds, effects, and entry screen controls stay available.",
  },
];

function SectionIntro({ eyebrow, title, sentence, className }: SectionIntroProps) {
  return (
    <div className={cn("max-w-[66ch]", className)}>
      <p className="text-[11px] tracking-[0.16em] text-white/48 uppercase">{eyebrow}</p>
      <h2 className="mt-4 text-[clamp(2rem,4.5vw,3.1rem)] leading-[1.02] font-semibold tracking-[-0.03em] text-white">
        {title}
      </h2>
      <p className="mt-4 text-[clamp(1rem,1.6vw,1.125rem)] leading-relaxed text-white/66">{sentence}</p>
    </div>
  );
}

function Reveal({ id, className, delay = 0, children }: RevealProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      id={id}
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={reduceMotion ? undefined : { once: true, amount: 0.2 }}
      transition={reduceMotion ? undefined : { duration: 0.36, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.section>
  );
}

function LandingAtmosphere() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[#050607]" />
      <div className="absolute inset-0 bg-[radial-gradient(84%_62%_at_50%_-10%,rgba(138,173,205,0.2),transparent_64%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(60%_56%_at_100%_34%,rgba(94,122,150,0.2),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(66%_58%_at_0%_92%,rgba(72,96,125,0.22),transparent_72%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#07090b_0%,#06080b_52%,#050607_100%)]" />

      <motion.div
        className="absolute top-[-8rem] left-[12%] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,rgba(145,183,220,0.22)_0%,rgba(145,183,220,0)_74%)] blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : {
                x: [0, 20, 0],
                y: [0, -10, 0],
                scale: [1, 1.05, 1],
              }
        }
        transition={
          reduceMotion
            ? undefined
            : {
                duration: 22,
                repeat: Infinity,
                ease: "easeInOut",
              }
        }
      />

      <motion.div
        className="absolute right-[-7rem] bottom-[-8rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(102,132,162,0.22)_0%,rgba(102,132,162,0)_72%)] blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : {
                x: [0, -18, 0],
                y: [0, 12, 0],
                scale: [1, 1.08, 1],
              }
        }
        transition={
          reduceMotion
            ? undefined
            : {
                duration: 24,
                repeat: Infinity,
                ease: "easeInOut",
              }
        }
      />

      <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="absolute inset-0 bg-[radial-gradient(130%_98%_at_50%_0%,transparent_40%,rgba(2,4,6,0.86)_100%)]" />
    </div>
  );
}

export default function HomePage() {
  const reduceMotion = useReducedMotion();

  return (
    <PageTransition className="relative min-h-screen overflow-x-clip bg-[#050607] text-white">
      <LandingAtmosphere />

      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#07090c]/76 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1240px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-white/14 bg-[#0d1219]"
            aria-label="Atlas home"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://clkbqxaezdzoyslnlsas.supabase.co/storage/v1/object/public/avatars/f61d669b-efe6-4fc7-ae65-1987e34c062f/download%20(1).png"
              alt=""
              className="h-full w-full object-contain p-0.5"
            />
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link key={item.label} href={item.href} className="text-sm text-white/62 transition-colors hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/auth?mode=sign-in"
              className="inline-flex h-9 items-center rounded-lg border border-white/14 bg-white/[0.02] px-3.5 text-sm text-white/82 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              Login
            </Link>
            <Link
              href="/auth?mode=sign-up"
              className="inline-flex h-9 items-center rounded-lg border border-[#8fb0d2]/44 bg-[#122132] px-3.5 text-sm font-medium text-white transition-colors hover:bg-[#1a2f45]"
            >
              Claim Handle
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1240px] px-4 pb-20 sm:px-6 lg:px-8">
        <section
          id="product"
          className="grid items-center gap-12 pt-12 pb-8 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] lg:gap-14 lg:pt-20"
        >
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={reduceMotion ? undefined : { duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-[11px] tracking-[0.16em] text-white/48 uppercase">Atlas Profile Platform</p>
            <h1 className="mt-5 max-w-[13ch] text-[clamp(2.8rem,7vw,4.7rem)] leading-[0.92] font-semibold tracking-[-0.045em] text-white">
              Clean profile pages with serious control.
            </h1>
            <p className="mt-6 max-w-[54ch] text-[clamp(1rem,1.6vw,1.12rem)] leading-relaxed text-white/66">
              Atlas gives you a structured editor, polished public page, and measured growth workflow. Core profile
              customization is included. Pro is a lifetime upgrade for advanced power features.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/auth?mode=sign-up"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#8fb0d2]/52 bg-[#16263a] px-5 text-sm font-medium text-white transition-colors hover:bg-[#1e3250]"
              >
                Start Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={PREMIUM_TICKET_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center rounded-lg border border-[#ceb589]/44 bg-[#2a2215] px-5 text-sm font-medium text-[#f3e7d1] transition-colors hover:bg-[#352b1b]"
              >
                Buy Pro - $10 Lifetime
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 text-xs text-white/58">
              <span className="rounded-full border border-white/14 bg-white/[0.02] px-3 py-1.5">No monthly fee for Pro</span>
              <span className="rounded-full border border-white/14 bg-white/[0.02] px-3 py-1.5">Discord ticket purchase flow</span>
              <span className="rounded-full border border-white/14 bg-white/[0.02] px-3 py-1.5">AI + Cursor Studio unlocked</span>
            </div>
          </motion.div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={reduceMotion ? undefined : { duration: 0.36, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="pointer-events-none absolute -top-8 right-10 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(211,182,129,0.25)_0%,rgba(211,182,129,0)_72%)] blur-2xl" />

            <div className="overflow-hidden rounded-[30px] border border-white/12 bg-[#090b10]/88 shadow-[0_44px_120px_-70px_rgba(0,0,0,0.95)]">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
                <p className="text-xs tracking-[0.1em] text-white/52 uppercase">Live profile system</p>
                <span className="rounded-full border border-[#cfb78a]/42 bg-[#332916] px-2.5 py-1 text-[10px] tracking-[0.1em] text-[#f2e3c6] uppercase">
                  Pro: $10 Lifetime
                </span>
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-[1.08fr_0.92fr]">
                <div className="rounded-2xl border border-white/11 bg-[#0a0d13] p-4">
                  <p className="text-xs text-white/58">Editor blocks</p>
                  <div className="mt-3 space-y-2">
                    {["Profile", "Links", "Entry Screen", "Appearance", "Analytics"].map((row, index) => (
                      <div
                        key={row}
                        className="flex items-center justify-between rounded-xl border border-white/9 bg-[#0f131a] px-3 py-2.5"
                      >
                        <span className="text-sm text-white/84">{row}</span>
                        <span className="text-[11px] text-white/44">0{index + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/11 bg-[#090c12] p-4">
                  <p className="text-xs text-white/58">Plan focus</p>
                  <div className="mt-3 space-y-2">
                    <div className="rounded-xl border border-white/10 bg-[#0f131a] px-3 py-2.5 text-sm text-white/82">
                      Free: full profile customization
                    </div>
                    <div className="rounded-xl border border-[#d4be95]/32 bg-[#1a1510] px-3 py-2.5 text-sm text-[#f2e5d0]">
                      Pro: AI Assist tools
                    </div>
                    <div className="rounded-xl border border-[#d4be95]/32 bg-[#1a1510] px-3 py-2.5 text-sm text-[#f2e5d0]">
                      Pro: Cursor Studio
                    </div>
                  </div>
                  <p className="mt-4 text-xs leading-relaxed text-white/52">
                    Keep your normal visuals and profile setup on free. Upgrade only when you need Pro extras.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <Reveal className="mt-20" delay={0.03}>
          <SectionIntro
            eyebrow="Starter"
            title="Everything needed to publish a serious profile is already included."
            sentence="Atlas starter users get full editor workflows and visual control. Pro is intentionally narrow and focused on advanced tools."
          />

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {CORE_FEATURES.map((feature, index) => {
              const Icon = feature.icon;

              return (
                <motion.article
                  key={feature.title}
                  className="rounded-2xl border border-white/11 bg-[#090c11]/84 p-5"
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={reduceMotion ? undefined : { once: true, amount: 0.35 }}
                  transition={
                    reduceMotion
                      ? undefined
                      : {
                          duration: 0.3,
                          delay: index * 0.05,
                          ease: [0.22, 1, 0.36, 1],
                        }
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-white/13 bg-white/[0.02] px-2.5 py-1 text-[10px] tracking-[0.1em] text-white/56 uppercase">
                      {feature.kicker}
                    </span>
                    <Icon className="h-4 w-4 text-[#a5c1db]" />
                  </div>
                  <h3 className="mt-3 text-lg font-medium tracking-[-0.02em] text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/62">{feature.sentence}</p>
                </motion.article>
              );
            })}
          </div>
        </Reveal>

        <Reveal id="pro" className="mt-24" delay={0.05}>
          <SectionIntro
            eyebrow="Pro Lifetime"
            title="$10 one-time. Keep Pro forever."
            sentence="No subscription for Pro. One purchase unlocks premium tools in your account."
          />

          <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <article className="rounded-[24px] border border-[#cfb88c]/38 bg-[linear-gradient(160deg,#2f2517_0%,#18130d_100%)] p-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d2bc93]/38 bg-[#221b11] px-3 py-1 text-[10px] tracking-[0.1em] text-[#f2e6d2] uppercase">
                <Crown className="h-3.5 w-3.5" />
                Atlas Pro
              </div>
              <div className="mt-5 flex items-end gap-2">
                <span className="text-6xl leading-none font-semibold tracking-[-0.04em] text-[#f5e8d1]">$10</span>
                <span className="pb-2 text-sm text-[#d8c6a7]">lifetime</span>
              </div>
              <p className="mt-4 max-w-[42ch] text-sm leading-relaxed text-[#dbc8aa]">
                Buy through Discord ticketing. Staff activates your Pro badge after payment confirmation.
              </p>
              <Link
                href={PREMIUM_TICKET_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex h-11 items-center justify-center rounded-lg border border-[#d5bf96]/42 bg-[#382d1b] px-5 text-sm font-medium text-[#f7ecda] transition-colors hover:bg-[#453621]"
              >
                Buy Pro in Discord
              </Link>
            </article>

            <div className="grid gap-3 sm:grid-cols-2">
              {PRO_FEATURES.map((feature, index) => {
                const Icon = feature.icon;

                return (
                  <motion.article
                    key={feature.title}
                    className="rounded-2xl border border-[#d2bb91]/28 bg-[#17120d] p-5"
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    viewport={reduceMotion ? undefined : { once: true, amount: 0.35 }}
                    transition={
                      reduceMotion
                        ? undefined
                        : {
                            duration: 0.3,
                            delay: index * 0.05,
                            ease: [0.22, 1, 0.36, 1],
                          }
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-full border border-[#d8c39a]/35 bg-[#241b11] px-2.5 py-1 text-[10px] tracking-[0.1em] text-[#e9d8ba] uppercase">
                        {feature.kicker}
                      </span>
                      <Icon className="h-4 w-4 text-[#e8d6b7]" />
                    </div>
                    <h3 className="mt-3 text-lg font-medium tracking-[-0.02em] text-[#f6ead5]">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[#dcc9aa]">{feature.sentence}</p>
                  </motion.article>
                );
              })}
            </div>
          </div>
        </Reveal>

        <Reveal id="compare" className="mt-24" delay={0.08}>
          <SectionIntro
            eyebrow="Plan Breakdown"
            title="Clear split: free core builder + focused Pro unlocks."
            sentence="Most profile tools stay accessible. Pro remains targeted for advanced writing and cursor systems."
          />

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-white/11 bg-[#090c11]/84 p-5">
              <p className="text-sm font-medium text-white">Starter - Free</p>
              <ul className="mt-4 space-y-2.5">
                {FREE_PLAN_LIST.map((item) => (
                  <li key={item.label} className="flex items-center gap-2 text-sm text-white/76">
                    <CheckCircle2 className="h-4 w-4 text-[#94b7da]" />
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-2xl border border-[#d1bb91]/32 bg-[#17120d] p-5">
              <p className="text-sm font-medium text-[#f4e7cf]">Pro - $10 Lifetime</p>
              <ul className="mt-4 space-y-2.5">
                {PRO_PLAN_LIST.map((item) => (
                  <li key={item.label} className="flex items-center gap-2 text-sm text-[#ddcbad]">
                    <CheckCircle2 className="h-4 w-4 text-[#e8d6b7]" />
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </Reveal>

        <Reveal className="mt-24" delay={0.1}>
          <SectionIntro
            eyebrow="Upgrade Flow"
            title="Simple 3-step Pro activation."
            sentence="No checkout complexity. Tickets are handled in Discord with staff-managed badge delivery."
          />

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {UPGRADE_STEPS.map((step, index) => (
              <article key={step.title} className="rounded-2xl border border-white/11 bg-[#090c11]/84 p-5">
                <p className="text-[11px] tracking-[0.14em] text-white/46 uppercase">Step 0{index + 1}</p>
                <h3 className="mt-2 text-lg font-medium tracking-[-0.02em] text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/62">{step.sentence}</p>
              </article>
            ))}
          </div>
        </Reveal>

        <Reveal className="mt-24" delay={0.12}>
          <SectionIntro
            eyebrow="FAQ"
            title="Quick answers before you launch."
            sentence="Everything below matches current platform behavior and Pro gating."
          />

          <div className="mt-8 space-y-3">
            {FAQ_ITEMS.map((item) => (
              <article key={item.question} className="rounded-2xl border border-white/11 bg-[#090c11]/84 p-5">
                <h3 className="text-base font-medium text-white">{item.question}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/62">{item.answer}</p>
              </article>
            ))}
          </div>
        </Reveal>

        <Reveal className="mt-24 pb-10" delay={0.14}>
          <div className="rounded-[26px] border border-white/12 bg-[#090b0f]/86 p-6 sm:p-8">
            <p className="text-[11px] tracking-[0.14em] text-white/46 uppercase">Launch now</p>
            <h2 className="mt-4 text-[clamp(1.9rem,3.5vw,2.5rem)] leading-[1.04] font-semibold tracking-[-0.03em] text-white">
              Claim your handle and publish.
            </h2>
            <p className="mt-3 max-w-[56ch] text-sm leading-relaxed text-white/62">
              Start with full core features for free. Upgrade to Pro anytime with one-time lifetime pricing.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth?mode=sign-up"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-[#8fb0d2]/48 bg-[#122132] px-5 text-sm font-medium text-white transition-colors hover:bg-[#19304a]"
              >
                Create Account
              </Link>
              <Link
                href={PREMIUM_TICKET_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-[#d4be95]/42 bg-[#352b1b] px-5 text-sm font-medium text-[#f6ead5] transition-colors hover:bg-[#43341f]"
              >
                Buy Pro - $10 Lifetime
              </Link>
            </div>
          </div>

          <footer className="mt-7 flex flex-col gap-3 border-t border-white/10 pt-4 text-xs text-white/42 sm:flex-row sm:items-center sm:justify-between">
            <p>(c) {new Date().getFullYear()} Atlas</p>
            <div className="flex items-center gap-4">
              <Link href="#product" className="transition-colors hover:text-white/72">Product</Link>
              <Link href="#pro" className="transition-colors hover:text-white/72">Pro</Link>
              <Link href="#compare" className="transition-colors hover:text-white/72">Compare</Link>
              <Link href="/docs" className="transition-colors hover:text-white/72">Docs</Link>
              <Link href="/about" className="transition-colors hover:text-white/72">About</Link>
              <Link href="/tos" className="transition-colors hover:text-white/72">Terms</Link>
              <Link href="/privacy" className="transition-colors hover:text-white/72">Privacy</Link>
            </div>
          </footer>
        </Reveal>
      </main>
    </PageTransition>
  );
}
