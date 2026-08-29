import { z } from "zod";

import { requireActiveUser } from "@/lib/auth";
import { requirePlatformOwner } from "@/lib/admin";
import { createR2SignedObjectUrl } from "@/lib/r2";
import { createAdminClient } from "@/lib/supabase/admin";

const assetIdSchema = z.uuid();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  await requireActiveUser();
  const parsedAssetId = assetIdSchema.safeParse((await params).assetId);
  if (!parsedAssetId.success) return Response.json({ error: "语音资源不存在。" }, { status: 404 });

  const admin = createAdminClient();
  const { data: asset } = await admin
    .from("learning_agent_script_audio_assets")
    .select("id,script_node_id,object_key,duration_ms,cue_timeline,voice_manifest,production_status")
    .eq("id", parsedAssetId.data)
    .eq("production_status", "ready")
    .maybeSingle();
  if (!asset) return Response.json({ error: "语音资源不存在。" }, { status: 404 });

  const { data: scriptNode } = await admin
    .from("learning_agent_script_nodes")
    .select("script_version_id")
    .eq("id", asset.script_node_id)
    .maybeSingle();
  const { data: publishedVersion } = scriptNode
    ? await admin
        .from("learning_agent_script_versions")
        .select("id")
        .eq("id", scriptNode.script_version_id)
        .eq("status", "published")
        .maybeSingle()
    : { data: null };
  // Students can only resolve published speech. Platform owners additionally
  // need to audition draft speech in the script studio before publishing it.
  if (!publishedVersion) await requirePlatformOwner();

  const audioUrl = await createR2SignedObjectUrl(String(asset.object_key));
  return Response.json({
    audioUrl,
    durationMs: Number(asset.duration_ms),
    cues: Array.isArray(asset.cue_timeline) ? asset.cue_timeline : [],
    voiceManifest: asset.voice_manifest && typeof asset.voice_manifest === "object" ? asset.voice_manifest : {},
  }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
