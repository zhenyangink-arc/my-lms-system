import { NextResponse } from "next/server";

import { requireActiveUser } from "@/lib/auth";
import {
  canUseStudentFeature,
  normalizeMembershipTier,
} from "@/lib/student-permissions";
import { createAdminClient } from "@/lib/supabase/admin";

const RECORDING_BUCKET = "digital-textbook-student-recordings";
const MIN_RECORDING_BYTES = 2_048;
const MAX_RECORDING_BYTES = 10 * 1_024 * 1_024;
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
]);

function extensionForMimeType(mimeType: string) {
  if (mimeType === "audio/ogg") return "ogg";
  if (mimeType === "audio/mp4") return "m4a";
  if (mimeType === "audio/mpeg") return "mp3";
  return "webm";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ activityId: string }> },
) {
  const { supabase, user, tenant, profile } = await requireActiveUser();
  if (
    !tenant ||
    !canUseStudentFeature(
      profile?.role ?? "student",
      normalizeMembershipTier(profile?.membership_tier),
      "korean_course",
    )
  ) {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { activityId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(activityId)) {
    return NextResponse.json({ message: "Invalid activity." }, { status: 400 });
  }

  const { data: activity } = await supabase
    .from("digital_textbook_activities")
    .select("id,activity_type")
    .eq("id", activityId)
    .maybeSingle();
  if (!activity || activity.activity_type !== "speaking") {
    return NextResponse.json(
      { message: "Speaking activity was not found." },
      { status: 404 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: "Invalid recording." }, { status: 400 });
  }
  const recording = formData.get("recording");
  if (!(recording instanceof File)) {
    return NextResponse.json({ message: "Recording is required." }, { status: 400 });
  }

  const mimeType = recording.type.toLowerCase().split(";", 1)[0];
  if (
    !ALLOWED_AUDIO_TYPES.has(mimeType) ||
    recording.size < MIN_RECORDING_BYTES ||
    recording.size > MAX_RECORDING_BYTES
  ) {
    return NextResponse.json(
      { message: "Recording type or size is invalid." },
      { status: 400 },
    );
  }

  const evidenceId = crypto.randomUUID();
  const filename = `${evidenceId}.${extensionForMimeType(mimeType)}`;
  const prefix = `${tenant.id}/${user.id}/${activity.id}`;
  const objectKey = `${prefix}/${filename}`;
  const admin = createAdminClient();
  const bytes = await recording.arrayBuffer();
  const { error: uploadError } = await admin.storage
    .from(RECORDING_BUCKET)
    .upload(objectKey, bytes, {
      contentType: mimeType,
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json(
      { message: "Recording upload is temporarily unavailable." },
      { status: 503 },
    );
  }

  const { data: objects, error: metadataError } = await admin.storage
    .from(RECORDING_BUCKET)
    .list(prefix, { search: filename, limit: 2 });
  const storedObject = objects?.find((item) => item.name === filename);
  const storedSize = Number(storedObject?.metadata?.size ?? 0);
  if (metadataError || !storedObject || storedSize < MIN_RECORDING_BYTES) {
    await admin.storage.from(RECORDING_BUCKET).remove([objectKey]);
    return NextResponse.json(
      { message: "Recording metadata could not be verified." },
      { status: 503 },
    );
  }

  const { error: evidenceError } = await admin
    .from("digital_textbook_speaking_evidence")
    .insert({
      id: evidenceId,
      tenant_id: tenant.id,
      student_id: user.id,
      activity_id: activity.id,
      object_key: objectKey,
      byte_size: storedSize,
      mime_type: mimeType,
    });
  if (evidenceError) {
    await admin.storage.from(RECORDING_BUCKET).remove([objectKey]);
    return NextResponse.json(
      { message: "Recording evidence could not be saved." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    evidenceId,
    byteSize: storedSize,
    mimeType,
  });
}
