import { redirect } from "next/navigation";

import { BannedGate } from "@/components/ui/banned-gate";
import { ProtectedNav } from "@/components/ui/protected-nav";
import { getDiscordAppealUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?mode=sign-in");
  }

  const [{ data: profile }, { data: isAdminData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("handle, is_banned, banned_reason")
      .eq("id", user.id)
      .maybeSingle<{
        handle: string;
        is_banned: boolean;
        banned_reason: string | null;
      }>(),
    supabase.rpc("is_admin", {
      p_user_id: user.id,
    }),
  ]);

  if (profile?.is_banned) {
    return <BannedGate reason={profile.banned_reason} appealUrl={getDiscordAppealUrl()} />;
  }

  return (
    <div className="app-shell min-h-screen min-h-[100dvh] bg-[#06090d] [--surface:rgb(16_20_28)] [--surface-strong:rgb(20_25_34)] [--surface-soft:rgb(13_17_24)] lg:h-screen lg:overflow-hidden">
      <div aria-hidden className="app-shell-spotlight" />
      <div aria-hidden className="app-shell-grain" />
      <div className="relative mx-auto flex min-h-screen min-h-[100dvh] w-full max-w-[1880px] gap-8 px-4 pb-6 pt-0 sm:px-6 lg:h-full lg:min-h-0 lg:px-12 lg:pt-6 xl:px-16">
        <ProtectedNav handle={profile?.handle} isAdmin={Boolean(isAdminData)} />
        <main className="scrollbar-hidden min-w-0 flex-1 overflow-y-visible pt-24 pb-8 lg:overflow-y-auto lg:pt-0 lg:pb-8">{children}</main>
      </div>
    </div>
  );
}
