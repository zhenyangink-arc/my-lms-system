import "server-only";
import { z } from "zod";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { SelectedVideoAssetInfo } from "./video-pilot-authoring";
import { parseVideoPilotDraft, readVideoPilotDraft } from "./video-pilot-authoring";

type SaveState = { status: "success" | "error"; message: string; fieldErrors?: Record<string, string[]> };
type Dependencies = {
  db: Pick<ReturnType<typeof createAdminClient>, "from">;
  inspectLocal: () => Promise<SelectedVideoAssetInfo>;
  checkR2: (key: string) => Promise<{ exists: boolean; size?: number; contentType?: string }>;
  saveAtomic: (args: Record<string, unknown>) => Promise<{ error: { code?: string; message: string } | null }>;
};

function failure(message: string, field = "videoPilot"): SaveState {
  return { status: "error", message, fieldErrors: { [field]: [message] } };
}

function singleString(form: FormData, name: string): string | null {
  const values = form.getAll(name);
  return values.length === 1 && typeof values[0] === "string" ? values[0] : null;
}

function activeKind(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value !== "object" || Array.isArray(value)) return true;
  const kind = (value as Record<string, unknown>).kind;
  return kind !== undefined && kind !== "none";
}

/** Private orchestration used by the owner-authorized action; null retains legacy save. */
export async function saveVideoPilotNode(form: FormData, dependencies: Dependencies): Promise<SaveState | null> {
  const requested = form.has("video_pilot_intent") || form.has("video_pilot_json");
  const nodeId = singleString(form, "node_id");
  if (!nodeId || !z.uuid().safeParse(nodeId).success) return failure("教学小节编号不正确。");
  const { data: current, error } = await dependencies.db.from("learning_agent_script_nodes")
    .select("id,script_version_id,node_key,node_type,title,teacher_script,configuration,reference_activity_id,action_type,next_node_key,remediation_node_key,is_required,updated_at,learning_agent_script_versions!inner(lesson_id,status)")
    .eq("id", nodeId).maybeSingle();
  if (error || !current) return failure("无法完整读取当前教学小节，请刷新后重试。");
  const stored = readVideoPilotDraft(current.configuration);
  if (stored.kind === "absent" && !requested) return null;
  if (stored.kind === "invalid") return failure("已保存的视频草稿配置不受支持，无法通过旧编辑器修改。");
  const intent = singleString(form, "video_pilot_intent");
  const token = singleString(form, "node_updated_at");
  const json = singleString(form, "video_pilot_json");
  if (!token || !json || intent !== (stored.kind === "absent" ? "enable" : "save")) {
    return failure("请通过视频草稿编辑器明确启用或保存，不能切回旧编辑方式。");
  }
  const versionRows = current.learning_agent_script_versions;
  const version = Array.isArray(versionRows) ? versionRows.length === 1 ? versionRows[0] : null : versionRows;
  if (!version || version.status !== "draft") return failure("只有草稿中的教学小节可以修改。");
  if (current.updated_at !== token) return failure("这个小节已经被其他操作更新，请刷新页面后重新编辑。");
  const parsed = parseVideoPilotDraft(json);
  if (!parsed.ok) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.issues) (fieldErrors[issue.field] ??= []).push(issue.message);
    return { status: "error", message: "请检查标出的视频草稿字段。", fieldErrors };
  }
  const configuration = current.configuration && typeof current.configuration === "object" && !Array.isArray(current.configuration)
    ? current.configuration as Record<string, unknown> : {};
  if (activeKind(configuration.interaction) || activeKind(configuration.studentTask)) {
    return failure("当前小节有自定义问题或学生任务，请先在原编辑器处理后再启用视频草稿。");
  }
  const secrets = await dependencies.db.from("learning_agent_node_interaction_secrets").select("node_id").eq("node_id", nodeId);
  if (secrets.error || !Array.isArray(secrets.data)) return failure("无法确认当前小节的私有答案状态，未保存草稿。");
  if (secrets.data.length) return failure("当前小节保存有私有答案，不能转换为视频暂停题草稿。");
  const draft = parsed.draft;
  const activityId = draft.cue?.activityId ?? null;
  if (activityId) {
    const lesson = await dependencies.db.from("learning_agent_lessons").select("module_id").eq("id", version.lesson_id).maybeSingle();
    const activity = await dependencies.db.from("digital_textbook_activities").select("node_id,activity_type").eq("id", activityId).maybeSingle();
    if (lesson.error || activity.error || !lesson.data?.module_id || !activity.data?.node_id || activity.data.activity_type !== "single_choice") {
      return failure("请选择当前学习步骤中的有效单选题。", "videoPilotActivityId");
    }
    const sourceNode = await dependencies.db.from("digital_textbook_nodes").select("module_id").eq("id", activity.data.node_id).maybeSingle();
    if (sourceNode.error || !sourceNode.data?.module_id || sourceNode.data.module_id !== lesson.data.module_id) {
      return failure("暂停题必须属于当前学习步骤。", "videoPilotActivityId");
    }
  }
  if (draft.media?.kind === "selected-local") {
    try {
      const asset = await dependencies.inspectLocal();
      if (asset.assetId !== draft.media.assetId || asset.videoDurationSeconds !== 30) throw new Error("unavailable");
      if (draft.cue?.atSeconds !== null && draft.cue?.atSeconds !== undefined && draft.cue.atSeconds >= asset.videoDurationSeconds) {
        return failure("所选素材的暂停时间须小于 30 秒。", "videoPilotCueAtSeconds");
      }
    } catch { return failure("所选视频素材暂不可用，未保存草稿。", "videoPilotMedia"); }
  } else if (draft.media?.kind === "r2-library") {
    try {
      const media = await dependencies.checkR2(draft.media.objectKey);
      if (!media.exists || !media.size || (media.contentType && !["video/mp4", "application/octet-stream"].includes(media.contentType.split(";")[0]))) {
        return failure("视频库素材不存在、为空或不是 MP4。", "videoPilotMedia");
      }
    } catch { return failure("视频库素材检查失败，未保存草稿。", "videoPilotMedia"); }
  }
  const { error: saveError } = await dependencies.saveAtomic({
    p_node_id: nodeId, p_expected_updated_at: token,
    p_node: { node_key: current.node_key, node_type: activityId ? "question" : "explanation", title: current.title,
      teacher_script: current.teacher_script, configuration: { ...configuration, videoPilot: draft },
      reference_activity_id: activityId, action_type: activityId ? "focus_activity" : "none",
      next_node_key: current.next_node_key, remediation_node_key: current.remediation_node_key, is_required: current.is_required },
    p_secret: null,
  });
  if (saveError) return failure(saveError.code === "P0001" ? "页面数据已变化或草稿已不可修改，请刷新后重试。" : "视频草稿保存失败，原内容未更改，请重试。");
  return { status: "success", message: "视频暂停题草稿已保存；完整流程预览和发布待接入。" };
}
