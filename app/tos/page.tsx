import type { Metadata } from "next";
import Link from "next/link";

import { PageTransition } from "@/components/ui/page-transition";
import { getDiscordAppealUrl, getDiscordPremiumTicketUrl } from "@/lib/env";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Atlas Terms of Service for account use, user content, premium access, and platform rules.",
};

const EFFECTIVE_DATE = "February 14, 2026";

export default function TermsPage() {
  const premiumTicketUrl = getDiscordPremiumTicketUrl();
  const supportUrl = getDiscordAppealUrl();

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
          <Link href="/privacy" className="btn btn-secondary text-sm">
            Privacy
          </Link>
          <Link href="/docs" className="btn btn-secondary text-sm">
            Docs
          </Link>
        </div>
      </header>

      <section className="panel space-y-4 p-7">
        <p className="section-kicker">Legal</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Terms of Service</h1>
        <p className="text-xs uppercase tracking-[0.12em] text-[#8f8679]">Effective date: {EFFECTIVE_DATE}</p>
        <p className="text-sm leading-relaxed text-[#c2b9ac]">
          These Terms govern your use of Atlas. By creating an account or using Atlas, you agree to be bound by these
          Terms and our Privacy Policy.
        </p>
      </section>

      <section className="panel mt-6 space-y-4 p-7 text-sm leading-relaxed text-[#c2b9ac]">
        <h2 className="text-xl font-semibold text-white">1. Eligibility and account responsibility</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>You must be legally able to enter a binding agreement to use Atlas.</li>
          <li>You are responsible for all activity under your account.</li>
          <li>You must keep login credentials secure and notify support if you suspect unauthorized access.</li>
          <li>You must provide accurate account information and keep it reasonably up to date.</li>
        </ul>

        <h2 className="text-xl font-semibold text-white">2. Account handles and profile identity</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Your handle must not impersonate others, violate rights, or create deliberate confusion.</li>
          <li>Atlas may reclaim, reassign, or restrict handles for abuse, conflicts, or legal compliance.</li>
          <li>Badges, verification states, and trust signals are controlled by Atlas and may be changed at any time.</li>
        </ul>

        <h2 className="text-xl font-semibold text-white">3. Acceptable use</h2>
        <p>
          You may not use Atlas for unlawful, abusive, fraudulent, or harmful activity. Prohibited behavior includes:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Publishing illegal content, malware, phishing destinations, or deceptive links.</li>
          <li>Harassment, threats, hate content, exploitation, or content that violates applicable law.</li>
          <li>Attempting to bypass security controls, rate limits, moderation decisions, or feature gates.</li>
          <li>Automated scraping, denial-of-service behavior, or attacks against the platform infrastructure.</li>
        </ul>

        <h2 className="text-xl font-semibold text-white">4. User content and license</h2>
        <p>
          You retain ownership of content you submit, upload, or publish to Atlas. You grant Atlas a non-exclusive,
          worldwide, royalty-free license to host, reproduce, display, and process that content solely to operate,
          secure, and improve the Service.
        </p>
        <p>
          You represent that you have the necessary rights to all content you upload, including music, images, fonts,
          and linked destinations.
        </p>

        <h2 className="text-xl font-semibold text-white">5. Premium and paid access</h2>
        <p>
          Some features require a Pro badge, including AI Assist and Cursor Studio functionality. Premium purchase
          requests are handled through Discord ticketing:{" "}
          <Link href={premiumTicketUrl} target="_blank" rel="noreferrer" className="text-[#cbb89a] underline">
            open premium ticket
          </Link>
          .
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Attempting to bypass Pro restrictions is a Terms violation.</li>
          <li>Pricing, feature scope, and badge status may change over time.</li>
          <li>Refund handling, if any, is managed according to the payment channel and applicable law.</li>
        </ul>

        <h2 className="text-xl font-semibold text-white">6. Availability and changes</h2>
        <p>
          Atlas is provided on an &quot;as is&quot; and &quot;as available&quot; basis. We may modify, suspend, or discontinue any
          feature at any time, with or without notice, including integrations and AI functionality.
        </p>

        <h2 className="text-xl font-semibold text-white">7. Suspension and termination</h2>
        <p>
          Atlas may remove content, limit features, suspend accounts, or terminate access if you violate these Terms,
          create risk for users or the Service, or where required by law.
        </p>
        <p>
          You may stop using Atlas at any time. Some records may be retained as described in the Privacy Policy for
          legal, security, and operational purposes.
        </p>

        <h2 className="text-xl font-semibold text-white">8. Disclaimers</h2>
        <p>
          Atlas does not guarantee uninterrupted availability, complete accuracy, or fitness for a specific purpose.
          AI-generated output is advisory only and may be incomplete or inaccurate.
        </p>

        <h2 className="text-xl font-semibold text-white">9. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, Atlas is not liable for indirect, incidental, or consequential
          damages, loss of profits, loss of data, or business interruption arising from your use of the Service.
        </p>

        <h2 className="text-xl font-semibold text-white">10. Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless Atlas, its operators, and affiliates from claims, liabilities,
          losses, and expenses arising from your content, your use of the Service, or your violation of these Terms.
        </p>

        <h2 className="text-xl font-semibold text-white">11. Policy relationship</h2>
        <p>
          Your use of Atlas is also governed by the{" "}
          <Link href="/privacy" className="text-[#cbb89a] underline">
            Privacy Policy
          </Link>
          . If there is a conflict between documents, these Terms control for service usage and conduct.
        </p>

        <h2 className="text-xl font-semibold text-white">12. Changes to terms</h2>
        <p>
          We may update these Terms from time to time. If material changes are made, the effective date will be
          updated. Continued use after that date means you accept the revised Terms.
        </p>

        <h2 className="text-xl font-semibold text-white">13. Contact</h2>
        <p>
          For Terms questions, appeals, or account issues, contact support through Discord:{" "}
          <Link href={supportUrl} target="_blank" rel="noreferrer" className="text-[#cbb89a] underline">
            open support
          </Link>
          .
        </p>
      </section>
    </PageTransition>
  );
}
