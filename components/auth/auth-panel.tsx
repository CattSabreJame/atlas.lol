"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { normalizeHandle } from "@/lib/handles";
import { createClient } from "@/lib/supabase/client";
import { handleSchema } from "@/lib/validations";

type AuthMode = "sign-in" | "sign-up" | "magic" | "reset";

interface AuthPanelProps {
  nextPath: string;
  defaultMode?: AuthMode;
  lockedMode?: "sign-in" | "sign-up";
}

type AvailabilityState = "idle" | "checking" | "available" | "taken" | "invalid";

interface SignupAvailabilityRow {
  handle_available: boolean;
  email_available: boolean;
}

interface AuthEmailApiResponse {
  message?: string;
  error?: string;
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function formatAuthError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Unable to continue right now.";
  }

  const message = error.message.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "Incorrect email or password.";
  }

  if (message.includes("email not confirmed")) {
    return "Please verify your email before signing in.";
  }

  if (message.includes("already registered")) {
    return "An account with this email already exists.";
  }

  if (message.includes("handle is already taken") || message.includes("profiles_handle_key")) {
    return "That handle is already taken.";
  }

  if (message.includes("signup_availability")) {
    return "Signup checks require the latest database migration.";
  }

  return error.message;
}

export function AuthPanel({ nextPath, defaultMode = "sign-in", lockedMode }: AuthPanelProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const reduceMotion = useReducedMotion();

  const [mode, setMode] = useState<AuthMode>(lockedMode ?? defaultMode);
  const [email, setEmail] = useState("");
  const [signupHandle, setSignupHandle] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [handleAvailability, setHandleAvailability] = useState<AvailabilityState>("idle");
  const [emailAvailability, setEmailAvailability] = useState<AvailabilityState>("idle");

  const signupCheckRequestRef = useRef(0);

  const checkSignupAvailability = useCallback(
    async (
      normalizedHandle: string,
      normalizedEmail: string,
    ): Promise<{ handleAvailable: boolean; emailAvailable: boolean }> => {
      const { data, error } = await supabase.rpc("signup_availability", {
        p_handle: normalizedHandle,
        p_email: normalizedEmail,
      });

      if (error) {
        throw error;
      }

      const row = (Array.isArray(data) ? data[0] : null) as SignupAvailabilityRow | null;

      if (!row) {
        throw new Error("Availability checks are unavailable right now.");
      }

      return {
        handleAvailable: row.handle_available,
        emailAvailable: row.email_available,
      };
    },
    [supabase],
  );

  function switchMode(nextMode: AuthMode) {
    if (lockedMode && nextMode !== lockedMode) {
      return;
    }

    setMode(nextMode);
    setErrorMessage("");
    setSuccessMessage("");
    setHandleAvailability("idle");
    setEmailAvailability("idle");
  }

  useEffect(() => {
    setMode(lockedMode ?? defaultMode);
    setErrorMessage("");
    setSuccessMessage("");
    setHandleAvailability("idle");
    setEmailAvailability("idle");
  }, [defaultMode, lockedMode]);

  useEffect(() => {
    if (mode !== "sign-up") {
      return;
    }

    const normalizedHandle = normalizeHandle(signupHandle);
    const parsedHandle = handleSchema.safeParse(normalizedHandle);
    const normalizedEmail = email.trim().toLowerCase();

    const shouldCheckHandle = normalizedHandle.length > 0;
    const handleValid = parsedHandle.success;
    const shouldCheckEmail = isLikelyEmail(normalizedEmail);

    if (!shouldCheckHandle) {
      setHandleAvailability("idle");
    } else if (!handleValid) {
      setHandleAvailability("invalid");
    } else {
      setHandleAvailability("checking");
    }

    if (!normalizedEmail) {
      setEmailAvailability("idle");
    } else if (!shouldCheckEmail) {
      setEmailAvailability("invalid");
    } else {
      setEmailAvailability("checking");
    }

    if ((!shouldCheckHandle || !handleValid) && !shouldCheckEmail) {
      return;
    }

    const requestId = signupCheckRequestRef.current + 1;
    signupCheckRequestRef.current = requestId;

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await checkSignupAvailability(
            handleValid ? normalizedHandle : "",
            shouldCheckEmail ? normalizedEmail : "",
          );

          if (signupCheckRequestRef.current !== requestId) {
            return;
          }

          if (shouldCheckHandle && handleValid) {
            setHandleAvailability(result.handleAvailable ? "available" : "taken");
          }

          if (shouldCheckEmail) {
            setEmailAvailability(result.emailAvailable ? "available" : "taken");
          }
        } catch {
          if (signupCheckRequestRef.current !== requestId) {
            return;
          }

          if (shouldCheckHandle && handleValid) {
            setHandleAvailability("idle");
          }

          if (shouldCheckEmail) {
            setEmailAvailability("idle");
          }
        }
      })();
    }, 320);

    return () => {
      window.clearTimeout(timer);
    };
  }, [checkSignupAvailability, email, mode, signupHandle]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        router.push(nextPath || "/dashboard");
        router.refresh();
        return;
      }

      if (mode === "sign-up") {
        const normalizedHandle = normalizeHandle(signupHandle);
        const parsedHandle = handleSchema.safeParse(normalizedHandle);
        const normalizedEmail = email.trim().toLowerCase();

        if (!parsedHandle.success) {
          throw new Error("Use 3-20 lowercase letters, numbers, or underscores for handle.");
        }

        if (!isLikelyEmail(normalizedEmail)) {
          throw new Error("Enter a valid email address.");
        }

        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters.");
        }

        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }

        const availability = await checkSignupAvailability(
          normalizedHandle,
          normalizedEmail,
        );

        if (!availability.handleAvailable) {
          throw new Error("That handle is already taken.");
        }

        if (!availability.emailAvailable) {
          throw new Error("An account with this email already exists. Use Login instead.");
        }

        const response = await fetch("/api/auth/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "sign-up",
            email: normalizedEmail,
            password,
            handle: normalizedHandle,
            nextPath,
          }),
        });
        const payload = (await response.json().catch(() => null)) as AuthEmailApiResponse | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to create account right now.");
        }

        setSuccessMessage(
          payload?.message
            ?? (lockedMode === "sign-up"
              ? "Account created. Verify your email, then use Login."
              : "Account created. Verify your email, then sign in."),
        );
        if (lockedMode !== "sign-up") {
          setMode("sign-in");
        }
        return;
      }

      if (mode === "magic") {
        const normalizedEmail = email.trim().toLowerCase();

        const response = await fetch("/api/auth/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "magic",
            email: normalizedEmail,
            nextPath,
          }),
        });
        const payload = (await response.json().catch(() => null)) as AuthEmailApiResponse | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to send magic link right now.");
        }

        setSuccessMessage(payload?.message ?? "Magic link sent. Open your email to continue.");
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();

      const response = await fetch("/api/auth/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "reset",
          email: normalizedEmail,
        }),
      });
      const payload = (await response.json().catch(() => null)) as AuthEmailApiResponse | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to send reset link right now.");
      }

      setSuccessMessage(payload?.message ?? "Password reset link sent. Check your inbox.");
    } catch (error) {
      setErrorMessage(formatAuthError(error));
    } finally {
      setLoading(false);
    }
  }

  const submitLabel =
    mode === "sign-in"
      ? "Sign in"
      : mode === "sign-up"
        ? "Create account"
        : mode === "magic"
          ? "Send magic link"
          : "Send reset link";
  const headingLabel = mode === "sign-up" ? "Create account" : mode === "sign-in" ? "Sign in" : mode === "magic" ? "Magic link" : "Reset password";
  const headingTitle =
    mode === "sign-up"
      ? "Create your account"
      : mode === "sign-in"
        ? "Welcome back"
        : mode === "magic"
          ? "Email magic link"
          : "Recover account access";
  const headingCopy =
    mode === "sign-up"
      ? "Choose your handle, then create your account with email and password."
      : mode === "sign-in"
        ? lockedMode === "sign-in"
          ? "Login with your email and password."
          : "Use password, magic link, or reset in the same place."
        : mode === "magic"
          ? "Send a one-time login link to your email."
          : "Send a password reset email.";
  const normalizedHandlePreview = normalizeHandle(signupHandle);
  const handleAvailabilityText =
    mode === "sign-up" && handleAvailability === "available"
      ? `@${normalizedHandlePreview} is available.`
      : mode === "sign-up" && handleAvailability === "checking"
        ? "Checking handle..."
        : mode === "sign-up" && handleAvailability === "taken"
          ? "This handle is already taken."
          : mode === "sign-up" && handleAvailability === "invalid"
            ? "Use 3-20 lowercase letters, numbers, or underscores."
            : "";
  const handleAvailabilityClass =
    handleAvailability === "available"
      ? "text-emerald-200"
      : handleAvailability === "taken" || handleAvailability === "invalid"
        ? "text-red-200"
        : "text-[#9f9588]";
  const emailAvailabilityText =
    mode === "sign-up" && emailAvailability === "available"
      ? "Email is available."
      : mode === "sign-up" && emailAvailability === "checking"
        ? "Checking email..."
        : mode === "sign-up" && emailAvailability === "taken"
          ? "Email already has an account."
          : mode === "sign-up" && emailAvailability === "invalid"
            ? "Enter a valid email address."
            : "";
  const emailAvailabilityClass =
    emailAvailability === "available"
      ? "text-emerald-200"
      : emailAvailability === "taken" || emailAvailability === "invalid"
        ? "text-red-200"
        : "text-[#9f9588]";
  const signupBlocked =
    mode === "sign-up"
    && (
      handleAvailability === "invalid"
      || handleAvailability === "taken"
      || handleAvailability === "checking"
      || emailAvailability === "taken"
      || emailAvailability === "checking"
      || emailAvailability === "invalid"
    );

  return (
    <motion.div
      className="panel w-full p-7 sm:p-8"
      initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-6">
        <p className="section-kicker">{headingLabel}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{headingTitle}</h2>
        <p className="mt-2 text-sm text-[#b0a799]">{headingCopy}</p>
      </div>

      {!lockedMode ? (
        <div className="segmented mb-5 grid grid-cols-4">
          <button className="segmented-btn" data-active={mode === "sign-in"} onClick={() => switchMode("sign-in")} type="button">
            Sign in
          </button>
          <button className="segmented-btn" data-active={mode === "sign-up"} onClick={() => switchMode("sign-up")} type="button">
            Sign up
          </button>
          <button className="segmented-btn" data-active={mode === "magic"} onClick={() => switchMode("magic")} type="button">
            Magic
          </button>
          <button className="segmented-btn" data-active={mode === "reset"} onClick={() => switchMode("reset")} type="button">
            Reset
          </button>
        </div>
      ) : (
        <div className="mb-5 rounded-xl border border-white/10 bg-black/18 px-3 py-2 text-xs text-[#b3aa9d]">
          {lockedMode === "sign-up" ? (
            <span>
              Already have an account?{" "}
              <Link className="text-[var(--accent-strong)] hover:underline" href="/auth?mode=sign-in">
                Login
              </Link>
            </span>
          ) : (
            <span>
              Need an account?{" "}
              <Link className="text-[var(--accent-strong)] hover:underline" href="/auth?mode=sign-up">
                Sign up
              </Link>
            </span>
          )}
        </div>
      )}

      <form className="space-y-3" onSubmit={handleSubmit}>
        <label className="block space-y-1.5 text-sm">
          <span className="text-[#d0c8bc]">Email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@studio.com"
            required
          />
          {mode === "sign-up" && emailAvailabilityText ? (
            <span className={`text-xs ${emailAvailabilityClass}`}>{emailAvailabilityText}</span>
          ) : null}
        </label>

        {mode === "sign-up" ? (
          <label className="block space-y-1.5 text-sm">
            <span className="text-[#d0c8bc]">Handle</span>
            <input
              className="input"
              type="text"
              autoComplete="username"
              value={signupHandle}
              onChange={(event) => setSignupHandle(normalizeHandle(event.target.value))}
              placeholder="your_handle"
              required
              minLength={3}
              maxLength={20}
              pattern="[a-z0-9_]{3,20}"
            />
            <span className="text-xs text-[#9f9588]">Lowercase letters, numbers, and underscores only.</span>
            {handleAvailabilityText ? (
              <span className={`text-xs ${handleAvailabilityClass}`}>{handleAvailabilityText}</span>
            ) : null}
          </label>
        ) : null}

        <AnimatePresence initial={false} mode="wait">
          {(mode === "sign-in" || mode === "sign-up") && (
            <motion.div
              key="password-fields"
              initial={reduceMotion ? undefined : { opacity: 0, y: -4 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className="space-y-3"
            >
              <label className="block space-y-1.5 text-sm">
                <span className="text-[#d0c8bc]">Password</span>
                <input
                  className="input"
                  type="password"
                  autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                />
              </label>

              {mode === "sign-up" ? (
                <label className="block space-y-1.5 text-sm">
                  <span className="text-[#d0c8bc]">Confirm password</span>
                  <input
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repeat password"
                    required
                    minLength={8}
                  />
                </label>
              ) : (
                <div className="flex flex-wrap gap-3 text-xs">
                  {lockedMode === "sign-in" ? (
                    <>
                      <Link className="text-[#9f9588] underline-offset-2 hover:text-[var(--accent-strong)] hover:underline" href="/auth?mode=reset">
                        Forgot password?
                      </Link>
                      <Link className="text-[#9f9588] underline-offset-2 hover:text-[var(--accent-strong)] hover:underline" href="/auth?mode=magic">
                        Use magic link
                      </Link>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="text-[#9f9588] underline-offset-2 hover:text-[var(--accent-strong)] hover:underline"
                      onClick={() => switchMode("reset")}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {errorMessage ? (
          <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">{errorMessage}</p>
        ) : null}

        {successMessage ? (
          <p className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            {successMessage}
          </p>
        ) : null}

        <button className="btn btn-primary w-full" disabled={loading || signupBlocked} type="submit">
          {loading ? "Please wait..." : submitLabel}
        </button>
      </form>
    </motion.div>
  );
}
