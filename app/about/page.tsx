import Link from "next/link";

import { Card } from "@/components/ui/card";
import { PageTransition } from "@/components/ui/page-transition";

export default function AboutPage() {
  return (
    <PageTransition className="mx-auto min-h-screen w-full max-w-[980px] px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" className="rounded-lg px-3 py-1.5 text-sm text-[#b9b0a2] transition hover:bg-white/6 hover:text-white">
          Back
        </Link>
        <Link href="/auth?mode=sign-up" className="btn btn-secondary text-sm">
          Open Atlas
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-5">
          <p className="section-kicker">About Atlas</p>
          <h1 className="display-lg max-w-[16ch] font-semibold text-white">A calmer product for creator identity.</h1>
          <p className="text-sm leading-relaxed text-[#b8afa2]">
            Atlas is a premium link-and-bio platform built for clarity. It keeps the editing workflow focused and the public profile clean, so creators can publish with less noise and better structure.
          </p>
          <p className="text-sm leading-relaxed text-[#b8afa2]">
            Core principles: fewer decisions per screen, clear visual hierarchy, and progressive disclosure for advanced controls.
          </p>
        </Card>

        <Card className="space-y-4">
          <p className="section-kicker">AI & Safety</p>
          <p className="text-sm leading-relaxed text-[#b6ada0]">
            Atlas includes optional AI writing support for bio generation, polish, and link copy suggestions.
          </p>
          <div className="rounded-xl border border-white/10 bg-black/24 p-4 text-xs leading-relaxed text-[#a9a092]">
            AI outputs are suggestions, not facts. Always review and edit before publishing.
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
