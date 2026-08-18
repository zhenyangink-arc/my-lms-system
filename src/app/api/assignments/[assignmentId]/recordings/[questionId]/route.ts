import { NextResponse } from "next/server";

import { requireActiveUser } from "@/lib/auth";
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "audio/ogg") return "ogg";
  if (mimeType === "audio/mp4") return "m4a";
  if (mimeType === "audio/mpeg") return "mp3";
  return "webm";
}

export async function POST(
  request: Request,
  {
    params,
  }: { params: Promise<{ assignmentId: string; questionId: string }> }
) {
  const { supabase, user, tenant, profile } = await requireActiveUser();
  if (!tenant || profile?.role !== "student") {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const { assignmentId, questionId } = await params;
  if (!isUuid(assignmentId) || !isUuid(questionId)) {
    return NextResponse.json({ message: "Invalid question." }, { status: 400 });
  }

  const { data: question } = await supabase
    .from("learning_assignment_questions")
    .select("id,assignment_id,question_type")
    .eq("id", questionId)
    .eq("assignment_id", assignmentId)
    .maybeSingle();
  if (!question || question.question_type !== "audio_recording") {
    return NextResponse.json(
      { message: "Speaking question was not found." },
      { status: 404 }
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
      { status: 400 }
    );
  }

  const evidenceId = crypto.randomUUID();
  const filename = `${evidenceId}.${extensionForMimeType(mimeType)}`;
  const prefix = `${tenant.id}/${user.id}/assignments/${assignmentId}/${questionId}`;
  const objectKey = `${prefix}/${filename}`;
  const admin = createAdminClient();
  const bytes = await recording.arrayBuffer();
  const { error: uploadError } = await admin.storage
    .from(RECORDING_BUCKET)
    .upload(objectKey, bytes, { contentType: mimeType, upsert: false });
  if (uploadError) {
    return NextResponse.json(
      { message: "录音上传暂时不可用，请稍后重试。" },
      { status: 503 }
    );
  }

  const { error: evidenceError } = await admin
    .from("learning_assignment_recording_evidence")
    .insert({
      id: evidenceId,
      tenant_id: tenant.id,
      student_id: user.id,
      assignment_id: assignmentId,
      question_id: questionId,
      object_key: objectKey,
      byte_size: recording.size,
      mime_type: mimeType,
    });
  if (evidenceError) {
    await admin.storage.from(RECORDING_BUCKET).remove([objectKey]);
    return NextResponse.json(
      { message: "录音证据保存失败，请重新录制。" },
      { status: 503 }
    );
  }

  return NextResponse.json({ evidenceId });
}
