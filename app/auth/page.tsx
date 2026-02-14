import { AuthPanel } from "@/components/auth/auth-panel";
import { PageTransition } from "@/components/ui/page-transition";

interface AuthPageProps {
  searchParams: Promise<{ next?: string; mode?: string }>;
}

const AUTH_BENEFITS = [
  "Email/password with secure sessions",
  "Signup, verification, magic link, and reset",
  "Protected app routes with profile bootstrap",
  "Calm UX built for daily use",
];

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const resolved = await searchParams;
  const nextPath = resolved.next?.startsWith("/") ? resolved.next : "/dashboard";
  const initialMode = resolved.mode === "sign-up" ? "sign-up" : resolved.mode === "magic" ? "magic" : resolved.mode === "reset" ? "reset" : "sign-in";
  const lockedMode =
    resolved.mode === "sign-up"
      ? "sign-up"
      : resolved.mode === "sign-in" || !resolved.mode
        ? "sign-in"
        : undefined;

  return (
    <PageTransition className="mx-auto flex min-h-screen w-full max-w-[1080px] items-center px-4 py-10 sm:px-6 lg:px-8">
      <section className="grid w-full gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="panel p-8 sm:p-10">
          <p className="section-kicker">Atlas Access</p>
          <h1 className="mt-4 display-lg max-w-[14ch] font-semibold text-white">A complete auth flow with minimal friction.</h1>
          <p className="mt-4 max-w-[44ch] text-sm leading-relaxed text-[#b6ada0]">
            Authentication is part of the product experience. Atlas keeps it simple, clean, and reliable from first signup to password recovery.
          </p>
          <div className="mt-6 space-y-2.5">
            {AUTH_BENEFITS.map((item) => (
              <div key={item} className="surface-soft px-4 py-3 text-sm text-[#ddd7cf]">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center">
          <AuthPanel nextPath={nextPath} defaultMode={initialMode} lockedMode={lockedMode} />
        </div>
      </section>
    </PageTransition>
  );
}
