import { NextResponse } from "next/server";

import { isCatboxUrl } from "@/lib/catbox";
import { rejectCrossOrigin } from "@/lib/request-security";
import { createClient } from "@/lib/supabase/server";

const CATBOX_UPLOAD_ENDPOINT = "https://catbox.moe/user/api.php";
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export async function POST(request: Request) {
  const rejected = rejectCrossOrigin(request);

  if (rejected) {
    return rejected;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload file is required." }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "Upload file is empty." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Upload file must be 50MB or smaller." }, { status: 400 });
  }

  const payload = new FormData();
  payload.append("reqtype", "fileupload");
  payload.append("fileToUpload", file, file.name || "upload.bin");

  let response: Response;

  try {
    response = await fetch(CATBOX_UPLOAD_ENDPOINT, {
      method: "POST",
      body: payload,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Catbox upload is unavailable right now." }, { status: 502 });
  }

  const rawText = (await response.text()).trim();
  const isErrorMessage = /^error/i.test(rawText);

  if (!response.ok || isErrorMessage || !isCatboxUrl(rawText)) {
    return NextResponse.json(
      { error: isErrorMessage ? rawText : "Catbox upload failed." },
      { status: 502 },
    );
  }

  return NextResponse.json({ url: rawText });
}
