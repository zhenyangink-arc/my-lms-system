"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePlatformOwner } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export type TeachingScriptActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

const uuid = z.uuid("数据编号不正确。");
const nodeSchema = z.object({
  nodeId: z.uuid(),
  nodeKey: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "节点标识只能使用小写字母、数字和连字符。"),
  nodeType: z.enum(["opening", "explanation", "example", "question", "instruction", "summary"]),
  titleZh: z.string().trim().min(1, "请填写节点标题。").max(80, "节点标题不能超过80个字。"),
  titleKo: z.string().trim().max(80, "韩文标题不能超过80个字。"),
  scriptZh: z.string().trim().min(1, "请填写中文老师台词。").max(1600, "单个节点台词不能超过1600个字。"),
  scriptKo: z.string().trim().max(1600, "韩文台词不能超过1600个字。"),
  displayKind: z.enum(["overview", "scene", "sequence", "expression", "question", "task", "summary"]),
  displayTitleZh: z.string().trim().max(80, "教学展示标题不能超过80个字。"),
  displayBodyZh: z.string().trim().max(600, "教学展示说明不能超过600个字。"),
  displayItemsZh: z.string().trim().max(1000, "教学展示要点不能超过1000个字。"),
  displayKorean: z.string().trim().max(1000, "韩语展示内容不能超过1000个字。"),
  displayTranslationZh: z.string().trim().max(600, "中文释义不能超过600个字。"),
  studentTaskKind: z.enum(["none", "play_expression_audio"]),
  studentTaskInstructionZh: z.string().trim().max(300, "学生任务说明不能超过300个字。"),
  studentTaskTargetLabelZh: z.string().trim().max(100, "目标名称不能超过100个字。"),
  studentTaskTargetKey: z.string().trim().max(200, "目标位置不能超过200个字符。"),
  visualCueTargetKey: z.enum(["", "scene:image"]),
  visualCueEffect: z.enum(["pulse"]),
  visualCuePulseCount: z.coerce.number().int().min(1).max(4),
  visualCueDurationMs: z.coerce.number().int().min(400).max(2500),
  interactionKind: z.enum(["none", "single_choice"]),
  interactionPromptZh: z.string().trim().max(300, "互动问题不能超过300个字。"),
  interactionOptions: z.string().trim().max(800, "互动选项不能超过800个字。"),
  interactionCorrectOption: z.coerce.number().int().min(1).max(6),
  interactionCorrectFeedbackZh: z.string().trim().max(600, "正确反馈不能超过600个字。"),
  interactionIncorrectFeedbackZh: z.string().trim().max(600, "错误反馈不能超过600个字。"),
  interactionMaxAttempts: z.coerce.number().int().min(1).max(5),
  interactionRequired: z.boolean(),
  hintZh: z.string().trim().max(600, "提示不能超过600个字。"),
  exampleZh: z.string().trim().max(600, "补充示例不能超过600个字。"),
  referenceActivityId: z.union([z.literal(""), z.uuid()]),
  actionType: z.enum(["none", "focus_activity", "play_expression", "complete_lesson"]),
  nextNodeKey: z.string().trim().max(100),
  remediationNodeKey: z.string().trim().max(100),
  continueLabelZh: z.string().trim().max(40),
  terminal: z.boolean(),
  required: z.boolean(),
}).superRefine((input, context) => {
  if (input.interactionKind !== "single_choice") return;
  const options = input.interactionOptions.split("\n").map((item) => item.trim()).filter(Boolean);
  if (!input.interactionPromptZh) {
    context.addIssue({ code: "custom", path: ["interactionPromptZh"], message: "请填写老师向学生提出的问题。" });
  }
  if (options.length < 2 || options.length > 6) {
    context.addIssue({ code: "custom", path: ["interactionOptions"], message: "请填写2—6个选项，每行一个。" });
  }
  if (new Set(options).size !== options.length) {
    context.addIssue({ code: "custom", path: ["interactionOptions"], message: "互动选项不能重复。" });
  }
  if (input.interactionCorrectOption > options.length) {
    context.addIssue({ code: "custom", path: ["interactionCorrectOption"], message: "正确答案序号超出了选项数量。" });
  }
  if (!input.interactionCorrectFeedbackZh || !input.interactionIncorrectFeedbackZh) {
    context.addIssue({ code: "custom", path: ["interactionCorrectFeedbackZh"], message: "请填写答对和答错后的老师反馈。" });
  }
});

function returnPath(formData: FormData) {
  const value = String(formData.get("return_to") ?? "");
  return /^\/(?:platform|[a-z0-9-]+)\/dashboard\/admin\/apps\/[a-z0-9-]+\/teaching-scripts(?:\?.*)?$/.test(value)
    ? value
    : "/platform/dashboard/admin/apps/korean/teaching-scripts";
}

function refreshStudio(path: string) {
  revalidatePath(path.split("?")[0]);
}

async function requireDraftVersion(versionId: string) {
  const admin = createAdminClient();
  const { data: version } = await admin
    .from("learning_agent_script_versions")
    .select("id,lesson_id,status")
    .eq("id", versionId)
    .maybeSingle();
  if (!version || version.status !== "draft") {
    throw new Error("只有草稿版本可以修改，请先创建草稿。");
  }
  return { admin, version };
}

async function copyPublishedInteractionSecretsToDraft(lessonId: string, draftVersionId: string) {
  const admin = createAdminClient();
  const { data: publishedVersion } = await admin
    .from("learning_agent_script_versions")
    .select("id")
    .eq("lesson_id", lessonId)
    .eq("status", "published")
    .maybeSingle();
  if (!publishedVersion) return;

  const [{ data: sourceNodes }, { data: draftNodes }] = await Promise.all([
    admin.from("learning_agent_script_nodes").select("id,node_key").eq("script_version_id", publishedVersion.id),
    admin.from("learning_agent_script_nodes").select("id,node_key").eq("script_version_id", draftVersionId),
  ]);
  const sourceByKey = new Map((sourceNodes ?? []).map((node) => [String(node.node_key), String(node.id)]));
  const sourceIds = [...sourceByKey.values()];
  if (!sourceIds.length) return;
  const { data: sourceSecrets } = await admin
    .from("learning_agent_node_interaction_secrets")
    .select("node_id,correct_option_index,correct_feedback,incorrect_feedback,evaluation")
    .in("node_id", sourceIds);
  const secretBySourceId = new Map((sourceSecrets ?? []).map((secret) => [String(secret.node_id), secret]));
  const rows = (draftNodes ?? []).flatMap((node) => {
    const sourceId = sourceByKey.get(String(node.node_key));
    const secret = sourceId ? secretBySourceId.get(sourceId) : null;
    return secret ? [{
      node_id: node.id,
      correct_option_index: secret.correct_option_index,
      correct_feedback: secret.correct_feedback,
      incorrect_feedback: secret.incorrect_feedback,
      evaluation: secret.evaluation,
    }] : [];
  });
  if (rows.length) {
    await admin.from("learning_agent_node_interaction_secrets").upsert(rows, { onConflict: "node_id", ignoreDuplicates: true });
  }
}

export async function createTeachingScriptDraftAction(formData: FormData) {
  const { supabase } = await requirePlatformOwner();
  const lessonId = uuid.parse(String(formData.get("lesson_id") ?? ""));
  const path = returnPath(formData);
  const { data: draftVersionId, error } = await supabase.rpc("create_learning_agent_script_draft", {
    p_lesson_id: lessonId,
  });
  if (error) throw new Error(error.message.includes("平台负责人") ? error.message : "创建教学脚本草稿失败。");
  if (draftVersionId) await copyPublishedInteractionSecretsToDraft(lessonId, String(draftVersionId));
  refreshStudio(path);
}

export async function addTeachingScriptNodeAction(formData: FormData) {
  const { user } = await requirePlatformOwner();
  const versionId = uuid.parse(String(formData.get("version_id") ?? ""));
  const path = returnPath(formData);
  const { admin, version } = await requireDraftVersion(versionId);
  const { data: lastNode } = await admin
    .from("learning_agent_script_nodes")
    .select("sort_order")
    .eq("script_version_id", versionId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = Math.min(200, Number(lastNode?.sort_order ?? 0) + 1);
  const nodeKey = `step-${nextOrder}-${crypto.randomUUID().slice(0, 6)}`;
  const { error } = await admin.from("learning_agent_script_nodes").insert({
    script_version_id: versionId,
    node_key: nodeKey,
    node_type: "explanation",
    sort_order: nextOrder,
    title: { "zh-CN": "新教学节点", "ko-KR": "새 수업 단계" },
    teacher_script: { "zh-CN": "请在右侧填写老师台词。", "ko-KR": "선생님 대사를 입력하세요." },
    configuration: {},
    action_type: "none",
    is_required: true,
  });
  if (error) throw new Error("新增教学节点失败，请检查节点数量后重试。");
  await admin.from("learning_agent_publish_logs").insert({
    lesson_id: version.lesson_id,
    script_version_id: versionId,
    action: "add_node",
    actor_id: user.id,
    details: { nodeKey },
  });
  refreshStudio(path);
}

export async function saveTeachingScriptNodeAction(
  _previousState: TeachingScriptActionState,
  formData: FormData,
): Promise<TeachingScriptActionState> {
  try {
    const { user } = await requirePlatformOwner();
    const parsed = nodeSchema.safeParse({
      nodeId: String(formData.get("node_id") ?? ""),
      nodeKey: String(formData.get("node_key") ?? ""),
      nodeType: String(formData.get("node_type") ?? ""),
      titleZh: String(formData.get("title_zh") ?? ""),
      titleKo: String(formData.get("title_ko") ?? ""),
      scriptZh: String(formData.get("script_zh") ?? ""),
      scriptKo: String(formData.get("script_ko") ?? ""),
      displayKind: String(formData.get("display_kind") ?? "overview"),
      displayTitleZh: String(formData.get("display_title_zh") ?? ""),
      displayBodyZh: String(formData.get("display_body_zh") ?? ""),
      displayItemsZh: String(formData.get("display_items_zh") ?? ""),
      displayKorean: String(formData.get("display_korean") ?? ""),
      displayTranslationZh: String(formData.get("display_translation_zh") ?? ""),
      studentTaskKind: String(formData.get("student_task_kind") ?? "none"),
      studentTaskInstructionZh: String(formData.get("student_task_instruction_zh") ?? ""),
      studentTaskTargetLabelZh: String(formData.get("student_task_target_label_zh") ?? ""),
      studentTaskTargetKey: String(formData.get("student_task_target_key") ?? ""),
      visualCueTargetKey: String(formData.get("visual_cue_target_key") ?? ""),
      visualCueEffect: String(formData.get("visual_cue_effect") ?? "pulse"),
      visualCuePulseCount: String(formData.get("visual_cue_pulse_count") ?? "2"),
      visualCueDurationMs: String(formData.get("visual_cue_duration_ms") ?? "1000"),
      interactionKind: String(formData.get("interaction_kind") ?? "none"),
      interactionPromptZh: String(formData.get("interaction_prompt_zh") ?? ""),
      interactionOptions: String(formData.get("interaction_options") ?? ""),
      interactionCorrectOption: String(formData.get("interaction_correct_option") ?? "1"),
      interactionCorrectFeedbackZh: String(formData.get("interaction_correct_feedback_zh") ?? ""),
      interactionIncorrectFeedbackZh: String(formData.get("interaction_incorrect_feedback_zh") ?? ""),
      interactionMaxAttempts: String(formData.get("interaction_max_attempts") ?? "3"),
      interactionRequired: formData.get("interaction_required") === "on",
      hintZh: String(formData.get("hint_zh") ?? ""),
      exampleZh: String(formData.get("example_zh") ?? ""),
      referenceActivityId: String(formData.get("reference_activity_id") ?? ""),
      actionType: String(formData.get("action_type") ?? "none"),
      nextNodeKey: String(formData.get("next_node_key") ?? ""),
      remediationNodeKey: String(formData.get("remediation_node_key") ?? ""),
      continueLabelZh: String(formData.get("continue_label_zh") ?? ""),
      terminal: formData.get("terminal") === "on",
      required: formData.get("required") === "on",
    });
    if (!parsed.success) {
      return {
        status: "error",
        message: "请检查标出的教学节点字段。",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const input = parsed.data;
    const admin = createAdminClient();
    const { data: current } = await admin
      .from("learning_agent_script_nodes")
      .select("id,script_version_id,configuration,learning_agent_script_versions!inner(lesson_id,status)")
      .eq("id", input.nodeId)
      .maybeSingle();
    const joinedVersion = Array.isArray(current?.learning_agent_script_versions)
      ? current.learning_agent_script_versions[0]
      : current?.learning_agent_script_versions;
    if (!current || !joinedVersion || joinedVersion.status !== "draft") {
      return { status: "error", message: "只有草稿节点可以修改。" };
    }

    const existingConfiguration = current.configuration && typeof current.configuration === "object"
      ? current.configuration as Record<string, unknown>
      : {};
    const configuration: Record<string, unknown> = { ...existingConfiguration };
    const displayItems = input.displayItemsZh
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    if (input.displayTitleZh || input.displayBodyZh || displayItems.length || input.displayKorean || input.displayTranslationZh) {
      configuration.display = {
        kind: input.displayKind,
        title: { "zh-CN": input.displayTitleZh },
        body: { "zh-CN": input.displayBodyZh },
        items: { "zh-CN": displayItems },
        korean: input.displayKorean,
        translation: { "zh-CN": input.displayTranslationZh },
      };
    } else {
      Reflect.deleteProperty(configuration, "display");
    }
    if (input.studentTaskKind === "play_expression_audio" && input.studentTaskTargetKey) {
      configuration.studentTask = {
        kind: input.studentTaskKind,
        instruction: { "zh-CN": input.studentTaskInstructionZh },
        targetLabel: { "zh-CN": input.studentTaskTargetLabelZh },
        targetKey: input.studentTaskTargetKey,
        eventType: "audio_completed",
        required: true,
      };
    } else {
      Reflect.deleteProperty(configuration, "studentTask");
    }
    if (input.visualCueTargetKey) {
      configuration.visualCue = {
        targetKey: input.visualCueTargetKey,
        effect: input.visualCueEffect,
        pulseCount: input.visualCuePulseCount,
        durationMs: input.visualCueDurationMs,
      };
    } else {
      Reflect.deleteProperty(configuration, "visualCue");
    }
    const interactionOptions = input.interactionOptions
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    if (input.interactionKind === "single_choice") {
      configuration.interaction = {
        kind: "single_choice",
        prompt: { "zh-CN": input.interactionPromptZh },
        options: interactionOptions,
        required: input.interactionRequired,
        maxAttempts: input.interactionMaxAttempts,
      };
    } else {
      Reflect.deleteProperty(configuration, "interaction");
    }
    if (input.hintZh) configuration.hint = { "zh-CN": input.hintZh };
    else Reflect.deleteProperty(configuration, "hint");
    if (input.exampleZh) configuration.example = { "zh-CN": input.exampleZh };
    else Reflect.deleteProperty(configuration, "example");
    if (input.continueLabelZh) configuration.continueLabel = { "zh-CN": input.continueLabelZh };
    else Reflect.deleteProperty(configuration, "continueLabel");
    configuration.terminal = input.terminal;

    const { error } = await admin
      .from("learning_agent_script_nodes")
      .update({
        node_key: input.nodeKey,
        node_type: input.nodeType,
        title: { "zh-CN": input.titleZh, "ko-KR": input.titleKo },
        teacher_script: { "zh-CN": input.scriptZh, "ko-KR": input.scriptKo },
        configuration,
        reference_activity_id: input.referenceActivityId || null,
        action_type: input.studentTaskKind === "play_expression_audio" ? "play_expression" : input.actionType,
        next_node_key: input.nextNodeKey || null,
        remediation_node_key: input.remediationNodeKey || null,
        is_required: input.required,
      })
      .eq("id", input.nodeId);
    if (error) {
      return {
        status: "error",
        message: error.code === "23505" ? "节点标识已经存在，请换一个标识。" : "教学节点保存失败，请稍后重试。",
      };
    }

    if (input.interactionKind === "single_choice") {
      const { error: interactionSecretError } = await admin
        .from("learning_agent_node_interaction_secrets")
        .upsert({
          node_id: input.nodeId,
          correct_option_index: input.interactionCorrectOption - 1,
          correct_feedback: { "zh-CN": input.interactionCorrectFeedbackZh },
          incorrect_feedback: { "zh-CN": input.interactionIncorrectFeedbackZh },
          evaluation: { kind: "option_index" },
        }, { onConflict: "node_id" });
      if (interactionSecretError) {
        return { status: "error", message: "教学内容已保存，但互动答案保存失败，请重试。" };
      }
    } else {
      await admin.from("learning_agent_node_interaction_secrets").delete().eq("node_id", input.nodeId);
    }

    await admin.from("learning_agent_publish_logs").insert({
      lesson_id: String(joinedVersion.lesson_id),
      script_version_id: String(current.script_version_id),
      action: "update_node",
      actor_id: user.id,
      details: { nodeId: input.nodeId, nodeKey: input.nodeKey },
    });

    refreshStudio(returnPath(formData));
    return { status: "success", message: "教学节点已保存到草稿。" };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "教学节点保存失败。" };
  }
}

export async function moveTeachingScriptNodeAction(formData: FormData) {
  const { supabase } = await requirePlatformOwner();
  const nodeId = uuid.parse(String(formData.get("node_id") ?? ""));
  const direction = z.enum(["up", "down"]).parse(String(formData.get("direction") ?? ""));
  const { error } = await supabase.rpc("move_learning_agent_script_node", {
    p_node_id: nodeId,
    p_direction: direction,
  });
  if (error) throw new Error("调整节点顺序失败。");
  refreshStudio(returnPath(formData));
}

export async function deleteTeachingScriptNodeAction(formData: FormData) {
  const { user } = await requirePlatformOwner();
  const nodeId = uuid.parse(String(formData.get("node_id") ?? ""));
  const path = returnPath(formData);
  const admin = createAdminClient();
  const { data: node } = await admin
    .from("learning_agent_script_nodes")
    .select("id,node_key,script_version_id,learning_agent_script_versions!inner(lesson_id,status)")
    .eq("id", nodeId)
    .maybeSingle();
  const version = Array.isArray(node?.learning_agent_script_versions)
    ? node.learning_agent_script_versions[0]
    : node?.learning_agent_script_versions;
  if (!node || !version || version.status !== "draft") throw new Error("只有草稿节点可以删除。");
  const { count } = await admin
    .from("learning_agent_script_nodes")
    .select("id", { count: "exact", head: true })
    .eq("script_version_id", node.script_version_id);
  if (Number(count ?? 0) <= 1) throw new Error("教学脚本至少需要保留一个节点。");
  await admin.from("learning_agent_script_nodes").delete().eq("id", nodeId);
  await admin.from("learning_agent_publish_logs").insert({
    lesson_id: String(version.lesson_id),
    script_version_id: String(node.script_version_id),
    action: "delete_node",
    actor_id: user.id,
    details: { nodeId, nodeKey: node.node_key },
  });
  refreshStudio(path);
}

export async function publishTeachingScriptAction(formData: FormData) {
  const { supabase } = await requirePlatformOwner();
  const versionId = uuid.parse(String(formData.get("version_id") ?? ""));
  const changeNote = z.string().trim().max(500).parse(String(formData.get("change_note") ?? ""));
  const { error } = await supabase.rpc("publish_learning_agent_script_version", {
    p_script_version_id: versionId,
    p_change_note: changeNote,
  });
  if (error) throw new Error(error.message);
  refreshStudio(returnPath(formData));
}
