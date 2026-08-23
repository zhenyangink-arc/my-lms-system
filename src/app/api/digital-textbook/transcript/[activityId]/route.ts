import { NextResponse } from "next/server";

import { requireActiveUser } from "@/lib/auth";
import {
  canUseStudentFeature,
  normalizeMembershipTier,
} from "@/lib/student-permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ activityId: string }> },
) {
  const { supabase, profile } = await requireActiveUser();
  const role = profile?.role ?? "student";
  if (
    !canUseStudentFeature(
      role,
      normalizeMembershipTier(profile?.membership_tier),
      "korean_course",
    )
  ) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { activityId } = await params;
  const pageIndex = Math.max(0, Number.parseInt(new URL(request.url).searchParams.get("page") ?? "0", 10) || 0);
  if (!/^[0-9a-f-]{36}$/i.test(activityId)) {
    return NextResponse.json({ message: "Invalid activity." }, { status: 400 });
  }

  // Read the learner-visible catalog through RLS before accessing the private
  // transcript with the service-role client.
  const { data: activity } = await supabase
    .from("digital_textbook_activities")
    .select("id,node_id,activity_type")
    .eq("id", activityId)
    .eq("activity_type", "listening")
    .maybeSingle();
  if (!activity) {
    return NextResponse.json({ message: "Transcript was not found." }, { status: 404 });
  }

  const { data: node } = await supabase
    .from("digital_textbook_nodes")
    .select("module_id")
    .eq("id", activity.node_id)
    .maybeSingle();
  const { data: module_ } = node
    ? await supabase
        .from("digital_textbook_modules")
        .select("chapter_id")
        .eq("id", node.module_id)
        .maybeSingle()
    : { data: null };
  const { data: chapter } = module_
    ? await supabase
        .from("digital_textbook_chapters")
        .select("status,version_id")
        .eq("id", module_.chapter_id)
        .maybeSingle()
    : { data: null };
  const { data: version } = chapter?.status === "published"
    ? await supabase
        .from("digital_textbook_versions")
        .select("status,textbook_id")
        .eq("id", chapter.version_id)
        .maybeSingle()
    : { data: null };
  const { data: textbook } = version?.status === "published"
    ? await supabase
        .from("digital_textbooks")
        .select("status")
        .eq("id", version.textbook_id)
        .maybeSingle()
    : { data: null };

  if (textbook?.status !== "published") {
    return NextResponse.json({ message: "Transcript was not found." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: track } = await admin
    .from("digital_textbook_listening_tracks")
    .select("transcript_ko,audio_status")
    .eq("activity_id", activity.id)
    .eq("page_index", pageIndex)
    .maybeSingle();
  const { data: secret } = await admin
    .from("digital_textbook_activity_secrets")
    .select("transcript_ko,audio_status")
    .eq("activity_id", activity.id)
    .maybeSingle();
  const transcript = String(track?.transcript_ko ?? secret?.transcript_ko ?? "").trim();
  const audioStatus = track?.audio_status ?? secret?.audio_status;

  if (audioStatus !== "ready" || !transcript) {
    return NextResponse.json({ message: "Transcript is not ready." }, { status: 404 });
  }

  return NextResponse.json(
    { transcript },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
