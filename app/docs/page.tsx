import type { Metadata } from "next";
import Link from "next/link";

import { PageTransition } from "@/components/ui/page-transition";
import { getDiscordPremiumTicketUrl } from "@/lib/env";

export const metadata: Metadata = {
  title: "Docs",
  description: "Atlas user documentation for account setup, profile editing, premium access, and publishing.",
};

const EFFECTIVE_DATE = "February 14, 2026";

export default function DocsPage() {
  const premiumTicketUrl = getDiscordPremiumTicketUrl();

  return (
    <PageTransition className="mx-auto min-h-screen w-full max-w-[980px] px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="rounded-lg px-3 py-1.5 text-sm text-[#b9b0a2] transition hover:bg-white/6 hover:text-white"
        >
          Back Home
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/tos" className="btn btn-secondary text-sm">
            Terms
          </Link>
          <Link href="/privacy" className="btn btn-secondary text-sm">
            Privacy
          </Link>
          <Link href="/auth?mode=sign-up" className="btn btn-primary text-sm">
            Open Atlas
          </Link>
        </div>
      </header>

      <section className="panel space-y-4 p-7">
        <p className="section-kicker">Atlas Docs</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Complete user guide</h1>
        <p className="text-sm leading-relaxed text-[#b8afa2]">
          This page is for users. It covers creating an account, editing your page, publishing safely, and upgrading
          to Pro.
        </p>
        <p className="text-xs uppercase tracking-[0.12em] text-[#8f8679]">Last updated: {EFFECTIVE_DATE}</p>
      </section>

      <section className="panel mt-6 space-y-4 p-7">
        <h2 className="text-xl font-semibold text-white">1. Create an account</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[#c2b9ac]">
          <li>Open Atlas and choose sign up with email/password or magic link.</li>
          <li>Confirm your email if your auth provider requires verification.</li>
          <li>Pick your `@handle`. Your public page lives at `/{'{handle}'}`.</li>
          <li>Open the editor to start building your page.</li>
        </ol>
      </section>

      <section className="panel mt-6 space-y-4 p-7">
        <h2 className="text-xl font-semibold text-white">2. Editor basics</h2>
        <p className="text-sm leading-relaxed text-[#c2b9ac]">
          The editor is where you configure your profile content and style. Use the top tabs to switch between
          sections, then press <span className="font-medium text-white">Save changes</span>.
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[#c2b9ac]">
          <li>Profile: avatar, display name, bio, badges, and identity fields.</li>
          <li>Links: add, edit, reorder, and style your links.</li>
          <li>Appearance: themes, background mode, entry screen, fonts, and visual effects.</li>
          <li>Music: connect approved provider URLs or uploaded tracks.</li>
          <li>AI Assist: optional writing helpers for bios and labels (Pro only).</li>
        </ol>
      </section>

      <section className="panel mt-6 space-y-4 p-7">
        <h2 className="text-xl font-semibold text-white">3. Build your page step by step</h2>
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-[#c2b9ac]">
          <li>
            Add your core identity first:
            display name, avatar, short bio, and one primary link.
          </li>
          <li>
            Add social and work links:
            website, portfolio, Discord, X, Instagram, YouTube, GitHub, or store links.
          </li>
          <li>
            Choose a layout and visual style:
            card style, profile effects, link effects, and icon tint.
          </li>
          <li>
            Set your background:
            theme, gradient, or media background.
          </li>
          <li>
            Configure entry screen:
            toggle it on/off, choose text, and set entry font options including custom upload.
          </li>
          <li>
            Save and open your public URL:
            check desktop and mobile rendering before sharing.
          </li>
        </ol>
      </section>

      <section className="panel mt-6 space-y-4 p-7">
        <h2 className="text-xl font-semibold text-white">4. Public vs private profile</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#c2b9ac]">
          <li>Public profile: anyone with your URL can view it.</li>
          <li>Private profile: your page is hidden from public visitors.</li>
          <li>Visibility is controlled from your editor/settings profile controls.</li>
          <li>Always save after changing visibility so the public route updates.</li>
        </ul>
      </section>

      <section className="panel mt-6 space-y-4 p-7">
        <h2 className="text-xl font-semibold text-white">5. Analytics and performance</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#c2b9ac]">
          <li>Use `/dashboard` to view profile views and link clicks.</li>
          <li>Track which links receive the most engagement.</li>
          <li>Iterate your hero text and top links based on click data.</li>
          <li>Keep links current and remove dead destinations.</li>
        </ul>
      </section>

      <section className="panel mt-6 space-y-4 p-7">
        <h2 className="text-xl font-semibold text-white">6. Pro features and upgrade</h2>
        <p className="text-sm leading-relaxed text-[#c2b9ac]">
          Atlas keeps most profile customization available to everyone. Pro is currently required for:
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#c2b9ac]">
          <li>AI Assist tools (Bio Generator, Link Label Helper, and Bio Polish).</li>
          <li>Cursor Studio uploads and active custom cursors.</li>
        </ul>
        <p className="text-sm text-[#c2b9ac]">
          To buy Pro, open a Discord ticket:{" "}
          <Link href={premiumTicketUrl} target="_blank" rel="noreferrer" className="text-[#cbb89a] underline">
            open ticket
          </Link>
          . A team member will handle upgrade setup.
        </p>
      </section>

      <section className="panel mt-6 space-y-4 p-7">
        <h2 className="text-xl font-semibold text-white">7. Troubleshooting</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#c2b9ac]">
          <li>If your page does not update, save again and refresh the public URL.</li>
          <li>If uploads fail, try a smaller file or supported file format.</li>
          <li>If AI Assist is blocked, confirm your account has the Pro badge.</li>
          <li>If a private profile is still visible, verify visibility mode and save state.</li>
          <li>For billing, badge, or account issues, use the Discord support ticket flow.</li>
        </ul>
      </section>
    </PageTransition>
  );
}
