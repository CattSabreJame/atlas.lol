"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

interface BannedGateProps {
  reason?: string | null;
  appealUrl: string;
}

export function BannedGate({ reason, appealUrl }: BannedGateProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);

    try {
      await supabase.auth.signOut();
    } finally {
      router.replace("/auth?mode=sign-in");
      router.refresh();
      setSigningOut(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4">
      <section className="panel w-full space-y-5 p-7 text-center">
        <p className="text-xs tracking-[0.2em] text-red-200/80 uppercase">Account Action</p>
        <h1 className="text-3xl font-semibold text-white">You have been banned</h1>
        <p className="rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          Reason: {reason?.trim() || "No reason provided."}
        </p>
        <p className="text-sm text-[#b0a595]">
          If you believe this was a mistake, appeal through Discord.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
          >
            {signingOut ? "Logging out..." : "Log out"}
          </button>
          <a className="btn btn-primary" href={appealUrl} target="_blank" rel="noreferrer">
            Appeal
          </a>
        </div>
      </section>
    </main>
  );
}
