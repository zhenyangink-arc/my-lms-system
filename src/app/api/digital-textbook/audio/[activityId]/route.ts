import { NextResponse } from "next/server";

import { requireActiveUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ activityId: string }> }
) {
  await requireActiveUser();
  const { activityId } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(activityId)) {
    return NextResponse.json({ message: "Invalid activity." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: activity } = await admin
    .from("digital_textbook_activities")
    .select("id,node_id")
    .eq("id", activityId)
    .maybeSingle();

  if (!activity) {
    return NextResponse.json({ message: "Audio was not found." }, { status: 404 });
  }

  const { data: node } = await admin
    .from("digital_textbook_nodes")
    .select("module_id")
    .eq("id", activity.node_id)
    .maybeSingle();

  if (!node) {
    return NextResponse.json({ message: "Audio was not found." }, { status: 404 });
  }

  const { data: module_ } = await admin
    .from("digital_textbook_modules")
    .select("chapter_id")
    .eq("id", node.module_id)
    .maybeSingle();

  if (!module_) {
    return NextResponse.json({ message: "Audio was not found." }, { status: 404 });
  }

  const { data: chapter } = await admin
    .from("digital_textbook_chapters")
    .select("status,version_id")
    .eq("id", module_.chapter_id)
    .maybeSingle();

  if (!chapter || chapter.status !== "published") {
    return NextResponse.json({ message: "Audio is not ready." }, { status: 404 });
  }

  const { data: version } = await admin
    .from("digital_textbook_versions")
    .select("status,textbook_id")
    .eq("id", chapter.version_id)
    .maybeSingle();

  if (!version || version.status !== "published") {
    return NextResponse.json({ message: "Audio is not ready." }, { status: 404 });
  }

  const { data: textbook } = await admin
    .from("digital_textbooks")
    .select("status")
    .eq("id", version.textbook_id)
    .maybeSingle();

  if (!textbook || textbook.status !== "published") {
    return NextResponse.json({ message: "Audio is not ready." }, { status: 404 });
  }

  const { data: secret } = await admin
    .from("digital_textbook_activity_secrets")
    .select("audio_object_key")
    .eq("activity_id", activity.id)
    .maybeSingle();

  if (!secret?.audio_object_key) {
    return NextResponse.json({ message: "Audio is not ready." }, { status: 404 });
  }

  const { data, error } = await admin.storage
    .from("digital-textbook-audio")
    .createSignedUrl(secret.audio_object_key, 60 * 10);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ message: "Audio is temporarily unavailable." }, { status: 503 });
  }

  return NextResponse.redirect(data.signedUrl, 307);
}
