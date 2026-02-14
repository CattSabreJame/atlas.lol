"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { PageTransition } from "@/components/ui/page-transition";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      setHasSession(Boolean(session));
      setReady(true);
    }

    initialize().catch(() => {
      if (mounted) {
        setReady(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasSession(Boolean(session));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!hasSession) {
      setErrorMessage("Reset session not found. Open your reset link again.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setSuccessMessage("Password updated. Redirecting to dashboard...");
    setLoading(false);

    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 900);
  }

  return (
    <PageTransition className="mx-auto flex min-h-screen w-full max-w-[880px] items-center px-4 py-10 sm:px-6">
      <section className="panel mx-auto w-full max-w-[540px] p-8">
        <div className="mb-5">
          <p className="section-kicker">Password recovery</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Set a new password</h1>
          <p className="mt-2 text-sm text-[#b0a799]">Use a strong password and keep it private.</p>
        </div>

        {!ready ? (
          <p className="mb-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-[#b2aa9d]">
            Checking reset session...
          </p>
        ) : null}

        {ready && !hasSession ? (
          <p className="mb-3 rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Recovery link invalid or expired. Request a new reset email from the auth page.
          </p>
        ) : null}

        <form className="space-y-3" onSubmit={handleSubmit}>
          <label className="block space-y-1.5 text-sm">
            <span className="text-[#d0c8bc]">New password</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="text-[#d0c8bc]">Confirm new password</span>
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={8}
            />
          </label>

          {errorMessage ? (
            <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{errorMessage}</p>
          ) : null}

          {successMessage ? (
            <p className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              {successMessage}
            </p>
          ) : null}

          <button className="btn btn-primary w-full" disabled={loading || !ready} type="submit">
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>

        <Link className="mt-4 inline-block text-xs text-[#9f9588] hover:text-white" href="/auth?mode=sign-in">
          Back to auth
        </Link>
      </section>
    </PageTransition>
  );
}
