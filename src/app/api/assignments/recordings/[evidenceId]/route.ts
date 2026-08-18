import { NextResponse } from "next/server";

import { requireActiveUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const RECORDING_BUCKET = "digital-textbook-student-recordings";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ evidenceId: string }> }
) {
  const { supabase, user, tenant, profile } = await requireActiveUser();
  const { evidenceId } = await params;
  if (!tenant || !isUuid(evidenceId)) {
    return NextResponse.json({ message: "Recording was not found." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: evidence } = await admin
    .from("learning_assignment_recording_evidence")
    .select("tenant_id,student_id,assignment_id,object_key")
    .eq("id", evidenceId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (!evidence) {
    return NextResponse.json({ message: "Recording was not found." }, { status: 404 });
  }

  const { data: canView } = await supabase.rpc(
    "current_user_can_view_learning_assignment",
    { p_assignment_id: evidence.assignment_id }
  );
  if (!canView || (profile?.role === "student" && evidence.student_id !== user.id)) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { data, error } = await admin.storage
    .from(RECORDING_BUCKET)
    .createSignedUrl(evidence.object_key, 60 * 10);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ message: "Recording is unavailable." }, { status: 503 });
  }
  return NextResponse.redirect(data.signedUrl);
}
