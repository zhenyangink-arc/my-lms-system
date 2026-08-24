import { NextResponse } from "next/server";

import { requireActiveUser } from "@/lib/auth";
import {
  canUseStudentFeature,
  normalizeMembershipTier,
} from "@/lib/student-permissions";
import {
  assertR2ObjectUpload,
  createR2SignedObjectUrl,
  createR2SignedUploadUrl,
  deleteR2Object,
} from "@/lib/r2";
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

function isGuidedRepeatMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const practiceKey = String((metadata as Record<string, unknown>).practiceKey ?? "");
  return practiceKey === "repeat-line" || practiceKey === "full-recall";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ activityId: string }> },
) {
  const { supabase, user, tenant, profile } = await requireActiveUser();
  if (!tenant || !canUseStudentFeature(
    profile?.role ?? "student",
    normalizeMembershipTier(profile?.membership_tier),
    "korean_course",
  )) return NextResponse.json({ message: "Forbidden." }, { status: 403 });

  const { activityId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(activityId)) {
    return NextResponse.json({ message: "Invalid recording." }, { status: 400 });
  }
  const { data: activity } = await supabase
    .from("digital_textbook_activities")
    .select("id,activity_type")
    .eq("id", activityId)
    .maybeSingle();
  if (!activity || activity.activity_type !== "speaking") {
    return NextResponse.json({ message: "Recording was not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const evidenceId = url.searchParams.get("evidenceId") ?? "";
  const practiceKey = url.searchParams.get("practiceKey") ?? "";
  const trackIndex = Number(url.searchParams.get("trackIndex"));
  const segmentIndex = Number(url.searchParams.get("segmentIndex"));
  const admin = createAdminClient();

  if (evidenceId) {
    if (!/^[0-9a-f-]{36}$/i.test(evidenceId)) {
      return NextResponse.json({ message: "Invalid recording." }, { status: 400 });
    }
    const { data: evidence } = await admin
      .from("digital_textbook_speaking_evidence")
      .select("id,object_key,mime_type,metadata")
      .eq("id", evidenceId)
      .eq("tenant_id", tenant.id)
      .eq("student_id", user.id)
      .eq("activity_id", activity.id)
      .maybeSingle();
    if (!evidence || !isGuidedRepeatMetadata(evidence.metadata)) {
      return NextResponse.json({ message: "Recording was not found." }, { status: 404 });
    }
    let signedUrl: string;
    try {
      signedUrl = await createR2SignedObjectUrl(evidence.object_key);
    } catch {
      return NextResponse.json({ message: "Recording is temporarily unavailable." }, { status: 503 });
    }
    const range = request.headers.get("range");
    const upstream = await fetch(signedUrl, {
      headers: range ? { Range: range } : undefined,
      cache: "no-store",
      signal: request.signal,
    });
    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json({ message: "Recording is temporarily unavailable." }, { status: 503 });
    }
    const headers = new Headers({
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Disposition": 'inline; filename="student-recording"',
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
    });
    for (const name of ["accept-ranges", "content-length", "content-range", "content-type"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (!headers.has("content-type")) headers.set("Content-Type", evidence.mime_type);
    return new Response(upstream.body, { status: upstream.status, headers });
  }

  if ((practiceKey !== "repeat-line" && practiceKey !== "full-recall") || !Number.isInteger(trackIndex) || trackIndex < 0 || !Number.isInteger(segmentIndex) || segmentIndex < 0) {
    return NextResponse.json({ message: "Invalid recording lookup." }, { status: 400 });
  }
  const { data: evidence } = await admin
    .from("digital_textbook_speaking_evidence")
    .select("id,byte_size,mime_type,metadata,created_at")
    .eq("tenant_id", tenant.id)
    .eq("student_id", user.id)
    .eq("activity_id", activity.id)
    .contains("metadata", { practiceKey, trackIndex, segmentIndex })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!evidence) return NextResponse.json({ recording: null }, { headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({
    recording: {
      evidenceId: evidence.id,
      byteSize: evidence.byte_size,
      mimeType: evidence.mime_type,
      playbackUrl: `/api/digital-textbook/recordings/${activity.id}?evidenceId=${encodeURIComponent(evidence.id)}`,
    },
  }, { headers: { "Cache-Control": "private, no-store" } });
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
    .select("id,activity_type,public_config")
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
  const sceneId = String(formData.get("sceneId") ?? "").slice(0, 80);
  const roleSide = String(formData.get("roleSide") ?? "").slice(0, 16);
  const turnIndex = Number(formData.get("turnIndex"));
  const transcript = String(formData.get("transcript") ?? "").normalize("NFC").slice(0, 500);
  const practiceKey = String(formData.get("practiceKey") ?? "").slice(0, 32);
  const trackIndex = Number(formData.get("trackIndex"));
  const segmentIndex = Number(formData.get("segmentIndex"));
  const durationSeconds = Number(formData.get("durationSeconds"));
  const filename = `${evidenceId}.${extensionForMimeType(mimeType)}`;
  const isDialogueRoleplay = activity.public_config?.practiceKind === "dialogue_roleplay";
  const isGuidedRepeat = practiceKey === "repeat-line" || practiceKey === "full-recall";
  const isIndependentOutput = activity.public_config?.presentation === "independent_output";
  const minimumDurationSeconds = Number(activity.public_config?.minimumSeconds ?? 1);
  if (isIndependentOutput && (!Number.isFinite(durationSeconds) || durationSeconds < minimumDurationSeconds)) {
    return NextResponse.json(
      { message: `Recording must be at least ${minimumDurationSeconds} seconds.` },
      { status: 422 },
    );
  }
  const hasValidRoleplayTurn = Boolean(sceneId)
    && (roleSide === "left" || roleSide === "right")
    && Number.isInteger(turnIndex)
    && turnIndex >= 0;
  if (isDialogueRoleplay && !hasValidRoleplayTurn) {
    return NextResponse.json({ message: "Invalid dialogue turn." }, { status: 400 });
  }
  if (isGuidedRepeat && (!Number.isInteger(trackIndex) || trackIndex < 0 || trackIndex > 8 || !Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex > 100)) {
    return NextResponse.json({ message: "Invalid guided repeat segment." }, { status: 400 });
  }
  const usesR2 = isDialogueRoleplay || isGuidedRepeat || isIndependentOutput;
  const prefix = usesR2
    ? `student-recordings/${tenant.id}/${user.id}/${activity.id}`
    : `${tenant.id}/${user.id}/${activity.id}`;
  const objectKey = `${prefix}/${filename}`;
  const admin = createAdminClient();
  const bytes = await recording.arrayBuffer();
  let storedSize = recording.size;
  if (usesR2) {
    try {
      const uploadUrl = await createR2SignedUploadUrl(objectKey, mimeType, recording.size);
      const uploadResponse = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": mimeType }, body: bytes });
      if (!uploadResponse.ok) throw new Error(`R2 upload failed: ${uploadResponse.status}`);
      await assertR2ObjectUpload(objectKey, recording.size);
    } catch {
      return NextResponse.json(
        { message: "Recording upload is temporarily unavailable." },
        { status: 503 },
      );
    }
  } else {
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
    storedSize = Number(storedObject?.metadata?.size ?? 0);
    if (metadataError || !storedObject || storedSize < MIN_RECORDING_BYTES) {
      await admin.storage.from(RECORDING_BUCKET).remove([objectKey]);
      return NextResponse.json(
        { message: "Recording metadata could not be verified." },
        { status: 503 },
      );
    }
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
      metadata: isDialogueRoleplay ? {
        sceneId,
        roleSide,
        turnIndex: Number.isInteger(turnIndex) && turnIndex >= 0 ? turnIndex : null,
        transcript: transcript || null,
        transcriptSource: transcript ? "browser_speech_recognition" : null,
      } : isGuidedRepeat ? {
        practiceKey,
        trackIndex,
        segmentIndex,
      } : isIndependentOutput ? {
        durationSeconds,
        storage: "r2",
      } : {},
    });
  if (evidenceError) {
    if (usesR2) await deleteR2Object(objectKey);
    else await admin.storage.from(RECORDING_BUCKET).remove([objectKey]);
    return NextResponse.json(
      { message: "Recording evidence could not be saved." },
      { status: 503 },
    );
  }

  if (isDialogueRoleplay || isGuidedRepeat || isIndependentOutput) {
    const previousEvidenceQuery = admin
      .from("digital_textbook_speaking_evidence")
      .select("id,object_key,consumed_at,metadata")
      .eq("tenant_id", tenant.id)
      .eq("student_id", user.id)
      .eq("activity_id", activity.id)
      .neq("id", evidenceId);
    const { data: previousEvidence } = isDialogueRoleplay
      ? await previousEvidenceQuery.contains("metadata", { sceneId, roleSide, turnIndex })
      : isGuidedRepeat
        ? await previousEvidenceQuery.contains("metadata", { practiceKey, trackIndex, segmentIndex })
        : await previousEvidenceQuery.is("consumed_at", null);

    const removedEvidenceIds: string[] = [];
    for (const previous of previousEvidence ?? []) {
      try {
        if ((previous.metadata as Record<string, unknown> | null)?.storage === "r2") {
          await deleteR2Object(previous.object_key);
        } else {
          const { error: removeError } = await admin.storage.from(RECORDING_BUCKET).remove([previous.object_key]);
          if (removeError) throw removeError;
        }
        removedEvidenceIds.push(previous.id);
      } catch {
        // Keep the database row when object deletion fails so the orphan can be retried safely.
      }
    }
    if (removedEvidenceIds.length > 0) {
      await admin
        .from("digital_textbook_speaking_evidence")
        .delete()
        .in("id", removedEvidenceIds);
    }
  }

  return NextResponse.json({
    evidenceId,
    byteSize: storedSize,
    mimeType,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ activityId: string }> },
) {
  const { supabase, user, tenant, profile } = await requireActiveUser();
  if (!tenant || !canUseStudentFeature(
    profile?.role ?? "student",
    normalizeMembershipTier(profile?.membership_tier),
    "korean_course",
  )) return NextResponse.json({ message: "Forbidden." }, { status: 403 });

  const { activityId } = await params;
  const evidenceId = new URL(request.url).searchParams.get("evidenceId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(activityId) || !/^[0-9a-f-]{36}$/i.test(evidenceId)) {
    return NextResponse.json({ message: "Invalid recording." }, { status: 400 });
  }
  const { data: activity } = await supabase
    .from("digital_textbook_activities")
    .select("id,activity_type,public_config")
    .eq("id", activityId)
    .maybeSingle();
  if (!activity || activity.activity_type !== "speaking") {
    return NextResponse.json({ message: "Recording was not found." }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: evidence } = await admin
    .from("digital_textbook_speaking_evidence")
    .select("id,object_key,consumed_at,metadata")
    .eq("id", evidenceId)
    .eq("tenant_id", tenant.id)
    .eq("student_id", user.id)
    .eq("activity_id", activity.id)
    .maybeSingle();
  if (!evidence) return NextResponse.json({ message: "Recording was not found." }, { status: 404 });
  const isDialogueRoleplay = activity.public_config?.practiceKind === "dialogue_roleplay";
  const isIndependentOutput = activity.public_config?.presentation === "independent_output";
  if (!isDialogueRoleplay && !isIndependentOutput && !isGuidedRepeatMetadata(evidence.metadata)) {
    return NextResponse.json({ message: "Recording was not found." }, { status: 404 });
  }
  if (evidence.consumed_at) {
    return NextResponse.json({ message: "Completed practice recordings cannot be deleted." }, { status: 409 });
  }

  try {
    if ((evidence.metadata as Record<string, unknown> | null)?.storage === "r2") {
      await deleteR2Object(evidence.object_key);
    } else {
      const { error: removeError } = await admin.storage.from(RECORDING_BUCKET).remove([evidence.object_key]);
      if (removeError) throw removeError;
    }
  } catch {
    return NextResponse.json({ message: "Recording could not be deleted." }, { status: 503 });
  }
  const { error } = await admin
    .from("digital_textbook_speaking_evidence")
    .delete()
    .eq("id", evidence.id);
  if (error) return NextResponse.json({ message: "Recording could not be deleted." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
