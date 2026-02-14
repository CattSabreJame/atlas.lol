import { redirect } from "next/navigation";

import { AdminPanel } from "@/components/admin/admin-panel";
import { PageTransition } from "@/components/ui/page-transition";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: isAdmin, error } = await supabase.rpc("is_admin", {
    p_user_id: user.id,
  });

  if (error || !isAdmin) {
    redirect("/dashboard");
  }

  return (
    <PageTransition className="mx-auto w-full max-w-[1180px]">
      <AdminPanel />
    </PageTransition>
  );
}
