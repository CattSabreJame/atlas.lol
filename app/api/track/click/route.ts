import { NextResponse } from "next/server";

import { getRequestIp, rejectCrossOrigin } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeTrackingToken } from "@/lib/tracking-rate-limit";
import { trackClickBodySchema } from "@/lib/validations";

export async function POST(request: Request) {
  const rejected = rejectCrossOrigin(request);

  if (rejected) {
    return rejected;
  }

  try {
    const ip = getRequestIp(request);

    if (!consumeTrackingToken(`click:${ip}`)) {
      return NextResponse.json({ error: "Too many tracking requests." }, { status: 429 });
    }

    const payload = await request.json();
    const parsed = trackClickBodySchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid click payload." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase.rpc("increment_link_click", {
      p_link_id: parsed.data.linkId,
    });

    if (error) {
      return NextResponse.json({ error: "Unable to track click." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Tracking is unavailable." }, { status: 503 });
  }
}
