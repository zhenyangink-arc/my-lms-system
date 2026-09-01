"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePlatformOwner } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MAX_TEACHING_BLACKBOARD_ELEMENTS,
  MAX_TEACHING_BLACKBOARD_JSON_LENGTH,
  MAX_TEACHING_BLACKBOARD_SLIDES,
  normalizeTeachingBlackboardSlides,
  teachingBlackboardSlideFitsHeader,
} from "@/lib/teaching-blackboard";
import { TEACHER_KIM_POSES } from "@/lib/teacher-kim-character";
import {
  normalizeTeachingBlackboardPlacement,
  TEACHING_VIRTUAL_CHARACTER_STAGE,
} from "@/lib/teaching-virtual-character";

export type TeachingScriptActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

const uuid = z.uuid("数据编号不正确。");
const nodeSchema = z.object({
  nodeId: z.uuid(),
  nodeKey: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "小节标识只能使用小写字母、数字和连字符。"),
  nodeType: z.enum(["opening", "explanation", "example", "question", "instruction", "summary"]),
  titleZh: z.string().trim().min(1, "请填写小节名称。").max(80, "小节名称不能超过80个字。"),
  titleKo: z.string().trim().max(80, "韩文标题不能超过80个字。"),
  scriptZh: z.string().trim().min(1, "请填写中文老师台词。").max(1600, "单个小节台词不能超过1600个字。"),
  scriptKo: z.string().trim().max(1600, "韩文台词不能超过1600个字。"),
  displayKind: z.enum(["overview", "scene", "sequence", "expression", "question", "task", "summary"]),
  displayTitleZh: z.string().trim().max(80, "教学展示标题不能超过80个字。"),
  displayItemsZh: z.string().trim().max(1000, "教学展示要点不能超过1000个字。"),
  displayKorean: z.string().trim().max(1000, "韩语展示内容不能超过1000个字。"),
  displayTranslationZh: z.string().trim().max(600, "中文释义不能超过600个字。"),
  displaySlidesJson: z.string().max(MAX_TEACHING_BLACKBOARD_JSON_LENGTH, "黑板画面内容过多，请减少画面或文字。"),
  blackboardX: z.coerce.number()
    .min(TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.minimumXPercent)
    .max(TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.maximumXPercent),
  blackboardY: z.coerce.number()
    .min(TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.minimumTopPercent)
    .max(TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.maximumTopPercent),
  blackboardScale: z.coerce.number()
    .min(TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.minimumScale)
    .max(TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.maximumScale),
  virtualCharacterKind: z.literal("uply-teacher"),
  virtualCharacterPosition: z.enum(["left", "right"]),
  scriptPerformances: z.array(z.object({
    pose: z.enum(TEACHER_KIM_POSES),
    characterX: z.coerce.number().min(10).max(90),
    characterY: z.coerce.number().min(0).max(TEACHING_VIRTUAL_CHARACTER_STAGE.maximumBottomPercent),
    characterScale: z.coerce.number().min(0.75).max(1.25),
    dialogueX: z.coerce.number().min(5).max(95),
    dialogueY: z.coerce.number().min(5).max(90),
    voiceEnabled: z.boolean(),
    voiceLanguage: z.enum(["auto", "zh-CN", "ko-KR"]),
    voiceRate: z.coerce.number().min(0.75).max(1.25),
    autoContinueToNext: z.boolean(),
  })).max(50),
  studentTaskKind: z.enum(["none", "play_expression_audio"]),
  studentTaskFollowVisualCue: z.boolean(),
  studentTaskInstructionZh: z.string().trim().max(300, "学生任务说明不能超过300个字。"),
  studentTaskTargetLabelZh: z.string().trim().max(100, "目标名称不能超过100个字。"),
  studentTaskTargetKey: z.string().trim().max(200, "目标位置不能超过200个字符。"),
  visualCueTargetKey: z.string().trim().max(200, "讲解指向不能超过200个字符。")
    .regex(/^[a-zA-Z0-9:_-]*$/, "讲解指向格式不正确。"),
  visualCueEffect: z.enum(["pulse"]),
  petActionTargetKey: z.string().trim().max(200, "宠物代点目标不能超过200个字符。")
    .regex(/^[a-zA-Z0-9:_-]*$/, "宠物代点目标格式不正确。"),
  visualCuePulseCount: z.coerce.number().int().min(1).max(4),
  visualCueDurationMs: z.coerce.number().int().min(400).max(2500),
  interactionKind: z.enum(["none", "single_choice", "referenced_activity"]),
  interactionPromptZh: z.string().trim().max(300, "互动问题不能超过300个字。"),
  interactionOptions: z.array(
    z.string().trim().max(300, "单个互动选项不能超过300个字。"),
  ).max(6, "最多只能填写6个选项。")
    .refine((options) => options.join("\n").length <= 800, "互动选项合计不能超过800个字。"),
  interactionCorrectOption: z.coerce.number().int().min(1).max(6),
  interactionCorrectFeedbackZh: z.string().trim().max(600, "正确反馈不能超过600个字。"),
  interactionIncorrectFeedbackZh: z.string().trim().max(600, "错误反馈不能超过600个字。"),
  interactionMaxAttempts: z.coerce.number().int().min(1).max(5),
  interactionRequired: z.boolean(),
  hintZh: z.string().trim().max(600, "提示不能超过600个字。"),
  exampleZh: z.string().trim().max(600, "补充示例不能超过600个字。"),
  bufferLineZh: z.string().trim().max(200, "过渡台词不能超过200个字。"),
  bufferLineKo: z.string().trim().max(200, "韩文过渡台词不能超过200个字。"),
  referenceActivityId: z.union([z.literal(""), z.uuid()]),
  flowMode: z.enum(["sequence", "jump", "end"]),
  nextNodeKey: z.string().trim().max(100),
  remediationNodeKey: z.string().trim().max(100),
  continueLabelZh: z.string().trim().max(40),
  terminal: z.boolean(),
  required: z.boolean(),
}).superRefine((input, context) => {
  if (input.studentTaskKind === "play_expression_audio" && !input.studentTaskTargetKey) {
    context.addIssue({
      code: "custom",
      path: ["studentTaskTargetKey"],
      message: "请选择学生需要完成的按钮或表达。",
    });
  }
  if (input.petActionTargetKey.startsWith("activity:")) {
    context.addIssue({
      code: "custom",
      path: ["petActionTargetKey"],
      message: "宠物代点不能指向答题类目标，请改选播放音频、翻页等按钮。",
    });
  }
  if (input.interactionKind === "single_choice") {
    const options = input.interactionOptions;
    if (!input.interactionPromptZh) {
      context.addIssue({ code: "custom", path: ["interactionPromptZh"], message: "请填写老师向学生提出的问题。" });
    }
    if (options.length < 2 || options.some((option) => !option)) {
      context.addIssue({ code: "custom", path: ["interactionOptions"], message: "请完整填写2—6个选项。" });
    }
    if (new Set(options).size !== options.length) {
      context.addIssue({ code: "custom", path: ["interactionOptions"], message: "互动选项不能重复。" });
    }
    if (input.interactionCorrectOption > options.length) {
      context.addIssue({ code: "custom", path: ["interactionCorrectOption"], message: "正确答案序号超出了选项数量。" });
    }
    if (!input.interactionCorrectFeedbackZh) {
      context.addIssue({ code: "custom", path: ["interactionCorrectFeedbackZh"], message: "请填写答对后的老师反馈。" });
    }
    if (!input.interactionIncorrectFeedbackZh) {
      context.addIssue({ code: "custom", path: ["interactionIncorrectFeedbackZh"], message: "请填写答错后的老师提示。" });
    }
  }
  if (input.interactionKind === "referenced_activity" && !input.referenceActivityId) {
    context.addIssue({ code: "custom", path: ["referenceActivityId"], message: "请选择要使用的教材活动。" });
  }
  if (input.flowMode === "jump" && !input.nextNodeKey) {
    context.addIssue({ code: "custom", path: ["nextNodeKey"], message: "请选择要跳转到的小节。" });
  }
  if (input.flowMode === "jump" && input.nextNodeKey === input.nodeKey) {
    context.addIssue({ code: "custom", path: ["nextNodeKey"], message: "不能跳转回当前小节。" });
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
    title: { "zh-CN": "新教学小节", "ko-KR": "새 수업 단계" },
    teacher_script: { "zh-CN": "请填写这一小节的老师台词。", "ko-KR": "선생님 대사를 입력하세요." },
    configuration: {
      virtualCharacter: {
        kind: "uply-teacher",
        position: "right",
      },
      scriptPerformances: [{
        pose: "explaining",
        characterX: 75,
        characterY: 0,
        characterScale: 1,
        dialogueX: 85,
        dialogueY: 30,
        voiceEnabled: true,
        voiceLanguage: "auto",
        voiceRate: 1,
      }],
    },
    action_type: "none",
    is_required: true,
  });
  if (error) throw new Error("新增教学小节失败，请检查小节数量后重试。");
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
    const scriptRows = formData.getAll("script_zh").map(String);
    const scriptPoses = formData.getAll("script_pose").map(String);
    const scriptVoices = formData.getAll("script_voice").map(String);
    const scriptVoiceLanguages = formData.getAll("script_voice_language").map(String);
    const scriptVoiceRates = formData.getAll("script_voice_rate").map(String);
    const scriptAutoContinues = formData.getAll("script_auto_continue").map(String);
    const scriptCharacterXs = formData.getAll("script_character_x").map(String);
    const scriptCharacterYs = formData.getAll("script_character_y").map(String);
    const scriptCharacterScales = formData.getAll("script_character_scale").map(String);
    const scriptDialogueXs = formData.getAll("script_dialogue_x").map(String);
    const scriptDialogueYs = formData.getAll("script_dialogue_y").map(String);
    const nonEmptyScriptIndexes = scriptRows.flatMap((line, index) => line.trim() ? [index] : []);
    const interactionOptionRows = formData.getAll("interaction_option").map(String);
    const parsed = nodeSchema.safeParse({
      nodeId: String(formData.get("node_id") ?? ""),
      nodeKey: String(formData.get("node_key") ?? ""),
      nodeType: String(formData.get("node_type") ?? ""),
      titleZh: String(formData.get("title_zh") ?? ""),
      titleKo: String(formData.get("title_ko") ?? ""),
      scriptZh: nonEmptyScriptIndexes.map((index) => scriptRows[index]).join("\n\n"),
      scriptKo: String(formData.get("script_ko") ?? ""),
      displayKind: String(formData.get("display_kind") ?? "overview"),
      displayTitleZh: String(formData.get("display_title_zh") ?? ""),
      displayItemsZh: String(formData.get("display_items_zh") ?? ""),
      displayKorean: String(formData.get("display_korean") ?? ""),
      displayTranslationZh: String(formData.get("display_translation_zh") ?? ""),
      displaySlidesJson: String(formData.get("display_slides_json") ?? ""),
      blackboardX: String(formData.get("blackboard_x") ?? TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.defaultXPercent),
      blackboardY: String(formData.get("blackboard_y") ?? TEACHING_VIRTUAL_CHARACTER_STAGE.blackboard.defaultTopPercent),
      blackboardScale: String(formData.get("blackboard_scale") ?? "1"),
      virtualCharacterKind: String(formData.get("virtual_character_kind") ?? "uply-teacher"),
      virtualCharacterPosition: String(formData.get("virtual_character_position") ?? "right"),
      scriptPerformances: nonEmptyScriptIndexes.map((index) => ({
        pose: scriptPoses[index] ?? "explaining",
        characterX: scriptCharacterXs[index] ?? "75",
        characterY: scriptCharacterYs[index] ?? "0",
        characterScale: scriptCharacterScales[index] ?? "1",
        dialogueX: scriptDialogueXs[index] ?? String(Math.min(92, Number(scriptCharacterXs[index] ?? 75) + 10)),
        dialogueY: scriptDialogueYs[index] ?? String(Math.min(90, Number(scriptCharacterYs[index] ?? 0) + 30)),
        voiceEnabled: (scriptVoices[index] ?? "on") === "on",
        voiceLanguage: scriptVoiceLanguages[index] ?? "auto",
        voiceRate: scriptVoiceRates[index] ?? "1",
        autoContinueToNext: (scriptAutoContinues[index] ?? "off") === "on",
      })),
      studentTaskKind: String(formData.get("student_task_kind") ?? "none"),
      studentTaskFollowVisualCue: formData.get("student_task_follow_visual_cue") === "on",
      studentTaskInstructionZh: String(formData.get("student_task_instruction_zh") ?? ""),
      studentTaskTargetLabelZh: String(formData.get("student_task_target_label_zh") ?? ""),
      studentTaskTargetKey: String(formData.get("student_task_target_key") ?? ""),
      visualCueTargetKey: String(formData.get("visual_cue_target_key") ?? ""),
      visualCueEffect: String(formData.get("visual_cue_effect") ?? "pulse"),
      visualCuePulseCount: String(formData.get("visual_cue_pulse_count") ?? "2"),
      visualCueDurationMs: String(formData.get("visual_cue_duration_ms") ?? "1000"),
      petActionTargetKey: String(formData.get("pet_action_target_key") ?? ""),
      interactionKind: String(formData.get("interaction_kind") ?? "none"),
      interactionPromptZh: String(formData.get("interaction_prompt_zh") ?? ""),
      interactionOptions: interactionOptionRows.length
        ? interactionOptionRows
        : String(formData.get("interaction_options") ?? "").split("\n"),
      interactionCorrectOption: String(formData.get("interaction_correct_option") ?? "1"),
      interactionCorrectFeedbackZh: String(formData.get("interaction_correct_feedback_zh") ?? ""),
      interactionIncorrectFeedbackZh: String(formData.get("interaction_incorrect_feedback_zh") ?? ""),
      interactionMaxAttempts: String(formData.get("interaction_max_attempts") ?? "3"),
      interactionRequired: true,
      hintZh: String(formData.get("hint_zh") ?? ""),
      exampleZh: String(formData.get("example_zh") ?? ""),
      bufferLineZh: String(formData.get("buffer_line_zh") ?? ""),
      bufferLineKo: String(formData.get("buffer_line_ko") ?? ""),
      referenceActivityId: String(formData.get("reference_activity_id") ?? ""),
      flowMode: String(formData.get("flow_mode") ?? "sequence"),
      nextNodeKey: String(formData.get("next_node_key") ?? ""),
      remediationNodeKey: String(formData.get("remediation_node_key") ?? ""),
      continueLabelZh: String(formData.get("continue_label_zh") ?? ""),
      terminal: formData.get("flow_mode") === "end",
      required: true,
    });
    if (!parsed.success) {
      return {
        status: "error",
        message: "请检查标出的教学小节字段。",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const input = parsed.data;
    let displaySlides = [] as ReturnType<typeof normalizeTeachingBlackboardSlides>;
    if (input.displaySlidesJson) {
      try {
        const decoded = JSON.parse(input.displaySlidesJson) as unknown;
        const decodedRecord = decoded && typeof decoded === "object" && !Array.isArray(decoded)
          ? decoded as Record<string, unknown>
          : null;
        const rawSlides = Array.isArray(decoded) ? decoded : decodedRecord?.slides;
        if (Array.isArray(rawSlides) && rawSlides.length > MAX_TEACHING_BLACKBOARD_SLIDES) {
          return {
            status: "error",
            message: `一个小节最多只能保存${MAX_TEACHING_BLACKBOARD_SLIDES}张黑板画面。`,
            fieldErrors: { displaySlidesJson: ["黑板画面数量超过上限。"] },
          };
        }
        if (Array.isArray(rawSlides) && rawSlides.some((slide) => {
          if (!slide || typeof slide !== "object" || Array.isArray(slide)) return false;
          return Array.isArray((slide as Record<string, unknown>).elements)
            && ((slide as Record<string, unknown>).elements as unknown[]).length > MAX_TEACHING_BLACKBOARD_ELEMENTS;
        })) {
          return {
            status: "error",
            message: `单张黑板画面最多只能放置${MAX_TEACHING_BLACKBOARD_ELEMENTS}项内容。`,
            fieldErrors: { displaySlidesJson: ["单张画面的内容数量超过上限。"] },
          };
        }
        displaySlides = normalizeTeachingBlackboardSlides(decoded);
      } catch {
        return {
          status: "error",
          message: "黑板画面数据不正确，请刷新页面后重新编辑。",
          fieldErrors: { displaySlidesJson: ["黑板画面无法读取。"] },
        };
      }
    }
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
      return { status: "error", message: "只有草稿中的教学小节可以修改。" };
    }

    const existingConfiguration = current.configuration && typeof current.configuration === "object"
      ? current.configuration as Record<string, unknown>
      : {};
    const configuration: Record<string, unknown> = { ...existingConfiguration };
    const displayItems = input.displayItemsZh
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    const maximumSegmentIndex = Math.max(0, nonEmptyScriptIndexes.length - 1);
    const normalizedSlides = displaySlides.map((slide) => ({
      ...slide,
      segmentIndex: Math.min(slide.segmentIndex, maximumSegmentIndex),
      elements: slide.elements.filter((element) => element.content.trim() || element.translation?.trim()),
    }));
    const hasMeaningfulSlide = normalizedSlides.some((slide) => slide.elements.length > 0);
    const blackboardPlacement = normalizeTeachingBlackboardPlacement({
      x: input.blackboardX,
      y: input.blackboardY,
      scale: input.blackboardScale,
    });
    const oversizedSlide = normalizedSlides.find((slide) => !teachingBlackboardSlideFitsHeader(slide));
    if (oversizedSlide) {
      return {
        status: "error",
        message: `黑板画面“${oversizedSlide.name}”的文字过多，请拆成多张画面。`,
        fieldErrors: { displaySlidesJson: ["单张黑板画面的文字过多，请减少文字或拆分画面。"] },
      };
    }
    if (hasMeaningfulSlide) {
      configuration.display = {
        mode: "slides",
        placement: blackboardPlacement,
        // Preserve intentionally empty slides after the first authored slide;
        // they let the teacher clear the blackboard for a later script line.
        slides: normalizedSlides,
      };
    } else if (input.displayTitleZh || displayItems.length || input.displayKorean || input.displayTranslationZh) {
      configuration.display = {
        kind: input.displayKind,
        placement: blackboardPlacement,
        title: { "zh-CN": input.displayTitleZh },
        items: { "zh-CN": displayItems },
        korean: input.displayKorean,
        translation: { "zh-CN": input.displayTranslationZh },
      };
    } else {
      configuration.display = {
        mode: "slides",
        placement: blackboardPlacement,
        slides: [],
      };
    }
    if (input.studentTaskKind === "play_expression_audio" && input.studentTaskTargetKey) {
      configuration.studentTask = {
        kind: input.studentTaskKind,
        instruction: { "zh-CN": input.studentTaskInstructionZh },
        targetLabel: { "zh-CN": input.studentTaskTargetLabelZh },
        targetKey: input.studentTaskTargetKey,
        followVisualCue: input.studentTaskFollowVisualCue,
        eventType: "audio_completed",
        required: true,
      };
    } else {
      Reflect.deleteProperty(configuration, "studentTask");
    }
    configuration.virtualCharacter = {
      kind: "uply-teacher",
      position: input.virtualCharacterPosition,
    };
    configuration.scriptPerformances = input.scriptPerformances;
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
    if (input.petActionTargetKey) {
      configuration.petAction = {
        targetKey: input.petActionTargetKey,
        action: "click",
      };
    } else {
      Reflect.deleteProperty(configuration, "petAction");
    }
    const interactionOptions = input.interactionOptions;
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
    if (input.bufferLineZh || input.bufferLineKo) configuration.bufferLine = {
      "zh-CN": input.bufferLineZh,
      "ko-KR": input.bufferLineKo,
    };
    else Reflect.deleteProperty(configuration, "bufferLine");
    if (input.flowMode !== "end" && input.continueLabelZh) configuration.continueLabel = { "zh-CN": input.continueLabelZh };
    else Reflect.deleteProperty(configuration, "continueLabel");
    configuration.terminal = input.flowMode === "end";

    const referenceActivityId = input.interactionKind === "referenced_activity"
      ? input.referenceActivityId
      : null;
    const effectiveNodeType = input.interactionKind === "none"
      ? input.nodeType === "question" ? "explanation" : input.nodeType
      : "question";
    const effectiveActionType = input.studentTaskKind === "play_expression_audio"
      ? "play_expression"
      : input.interactionKind === "referenced_activity"
        ? "focus_activity"
        : "none";

    const { error } = await admin
      .from("learning_agent_script_nodes")
      .update({
        node_key: input.nodeKey,
        node_type: effectiveNodeType,
        title: { "zh-CN": input.titleZh, "ko-KR": input.titleKo },
        teacher_script: { "zh-CN": input.scriptZh, "ko-KR": input.scriptKo },
        configuration,
        reference_activity_id: referenceActivityId,
        action_type: effectiveActionType,
        next_node_key: input.flowMode === "jump" ? input.nextNodeKey : null,
        remediation_node_key: input.interactionKind === "referenced_activity" ? input.remediationNodeKey || null : null,
        is_required: true,
      })
      .eq("id", input.nodeId);
    if (error) {
      return {
        status: "error",
        message: error.code === "23505" ? "小节标识已经存在，请换一个标识。" : "教学小节保存失败，请稍后重试。",
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
    return { status: "success", message: "教学小节已保存到草稿。" };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "教学小节保存失败。" };
  }
}

export async function saveCharacterStyleTemplateAction(formData: FormData) {
  const { user } = await requirePlatformOwner();
  const nodeId = uuid.parse(String(formData.get("node_id") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  const path = returnPath(formData);
  if (!name) throw new Error("请填写模板名称。");
  if (name.length > 60) throw new Error("模板名称不能超过60个字。");
  const admin = createAdminClient();
  const { data: sourceNode } = await admin
    .from("learning_agent_script_nodes")
    .select("configuration")
    .eq("id", nodeId)
    .maybeSingle();
  if (!sourceNode) throw new Error("找不到这个教学小节。");
  const configuration = sourceNode.configuration && typeof sourceNode.configuration === "object"
    ? sourceNode.configuration as Record<string, unknown>
    : {};
  const performances = Array.isArray(configuration.scriptPerformances)
    ? configuration.scriptPerformances as Record<string, unknown>[]
    : [];
  const firstPerformance = performances[0];
  if (!firstPerformance) throw new Error("当前小节还没有台词，无法存为模板。");
  const virtualCharacter = configuration.virtualCharacter && typeof configuration.virtualCharacter === "object"
    ? configuration.virtualCharacter as Record<string, unknown>
    : {};
  const display = configuration.display && typeof configuration.display === "object"
    ? configuration.display as Record<string, unknown>
    : {};
  const blackboardPlacement = normalizeTeachingBlackboardPlacement(display.placement);
  const { error } = await admin.from("learning_agent_character_style_templates").insert({
    name,
    virtual_character_position: virtualCharacter.position === "left" ? "left" : "right",
    character_x: Number(firstPerformance.characterX ?? 75),
    character_y: Number(firstPerformance.characterY ?? 0),
    character_scale: Number(firstPerformance.characterScale ?? 1),
    dialogue_x: Number(firstPerformance.dialogueX ?? 85),
    dialogue_y: Number(firstPerformance.dialogueY ?? 30),
    blackboard_x: blackboardPlacement.x,
    blackboard_y: blackboardPlacement.y,
    blackboard_scale: blackboardPlacement.scale,
    created_by: user.id,
  });
  if (error) throw new Error("保存模板失败，请重试。");
  refreshStudio(path);
}

export async function deleteCharacterStyleTemplateAction(formData: FormData) {
  await requirePlatformOwner();
  const templateId = uuid.parse(String(formData.get("template_id") ?? ""));
  const path = returnPath(formData);
  const admin = createAdminClient();
  await admin.from("learning_agent_character_style_templates").delete().eq("id", templateId);
  refreshStudio(path);
}

const blackboardLayoutElementSchema = z.object({
  type: z.enum(["text", "bullets", "expression"]),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(8).max(100),
  height: z.number().min(6).max(100),
  fontSize: z.number().int().min(12).max(56),
  fontWeight: z.union([z.literal(400), z.literal(600), z.literal(700)]),
  align: z.enum(["left", "center", "right"]),
  tone: z.enum(["default", "primary", "highlight", "muted"]),
});

export async function saveBlackboardLayoutTemplateAction(formData: FormData) {
  const { user } = await requirePlatformOwner();
  const name = String(formData.get("name") ?? "").trim();
  const background = z.enum(["plain", "warm", "grid"]).parse(String(formData.get("background") ?? "plain"));
  const path = returnPath(formData);
  if (!name) throw new Error("请填写版式名称。");
  if (name.length > 60) throw new Error("版式名称不能超过60个字。");
  let elementsInput: unknown;
  try {
    elementsInput = JSON.parse(String(formData.get("elements_json") ?? "[]"));
  } catch {
    throw new Error("版式数据不正确，请重试。");
  }
  const elements = z.array(blackboardLayoutElementSchema).min(1, "这张画面还没有内容，无法存为版式。").max(MAX_TEACHING_BLACKBOARD_ELEMENTS).parse(elementsInput);
  const admin = createAdminClient();
  const { error } = await admin.from("learning_agent_blackboard_layout_templates").insert({
    name,
    background,
    elements,
    created_by: user.id,
  });
  if (error) throw new Error("保存版式失败，请重试。");
  refreshStudio(path);
}

export async function deleteBlackboardLayoutTemplateAction(formData: FormData) {
  await requirePlatformOwner();
  const templateId = uuid.parse(String(formData.get("template_id") ?? ""));
  const path = returnPath(formData);
  const admin = createAdminClient();
  await admin.from("learning_agent_blackboard_layout_templates").delete().eq("id", templateId);
  refreshStudio(path);
}

export async function moveTeachingScriptNodeAction(formData: FormData) {
  const { supabase } = await requirePlatformOwner();
  const nodeId = uuid.parse(String(formData.get("node_id") ?? ""));
  const direction = z.enum(["up", "down"]).parse(String(formData.get("direction") ?? ""));
  const { error } = await supabase.rpc("move_learning_agent_script_node", {
    p_node_id: nodeId,
    p_direction: direction,
  });
  if (error) throw new Error("调整教学小节顺序失败。");
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
  if (!node || !version || version.status !== "draft") throw new Error("只有草稿中的教学小节可以删除。");
  const { count } = await admin
    .from("learning_agent_script_nodes")
    .select("id", { count: "exact", head: true })
    .eq("script_version_id", node.script_version_id);
  if (Number(count ?? 0) <= 1) throw new Error("每个学习步骤至少需要保留一个教学小节。");
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

export async function deleteTeachingScriptVersionAction(formData: FormData) {
  await requirePlatformOwner();
  const versionId = uuid.parse(String(formData.get("version_id") ?? ""));
  const path = returnPath(formData);
  const admin = createAdminClient();
  const { data: version } = await admin
    .from("learning_agent_script_versions")
    .select("id,status")
    .eq("id", versionId)
    .maybeSingle();
  if (!version) throw new Error("没有找到要删除的版本。");
  if (version.status !== "archived") throw new Error("只有已归档的历史版本可以删除，草稿和已发布版本不能删除。");
  const { count: attemptCount } = await admin
    .from("learning_agent_node_attempts")
    .select("id", { count: "exact", head: true })
    .eq("script_version_id", versionId);
  if (Number(attemptCount ?? 0) > 0) throw new Error("这个版本还留有学生的作答记录，无法删除，以免丢失学习数据。");
  const { error } = await admin.from("learning_agent_script_versions").delete().eq("id", versionId);
  if (error) throw new Error("删除版本失败，请稍后重试。");
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
