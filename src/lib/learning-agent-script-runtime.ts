import "server-only";

import { parseRichText, richCharsToPlainText, stripRichText, type RichChar } from "@/lib/rich-teaching-text";
import type { createAdminClient } from "@/lib/supabase/admin";
import { isTeacherKimPose } from "@/lib/teacher-kim-character";
import { normalizeTeachingVirtualCharacterPlacement } from "@/lib/teaching-virtual-character";

type AdminClient = ReturnType<typeof createAdminClient>;

export type Locale = "zh-CN" | "ko-KR";
export const BUFFER_LINE_SEGMENT_INDEX = 199;
export const DEFAULT_BUFFER_LINES: Record<Locale, string> = {
  "zh-CN": "稍等一下，我看看这里怎么讲…",
  "ko-KR": "잠시만요, 이 부분을 한번 볼게요…",
};

type Localized = Record<string, unknown>;

export type ScriptNodeRow = {
  id: string;
  script_version_id: string;
  node_key: string;
  node_type: string;
  sort_order: number;
  teacher_script: unknown;
  configuration: Record<string, unknown> | null;
  reference_activity_id: string | null;
  action_type: string;
  next_node_key: string | null;
  remediation_node_key: string | null;
};

export class ScriptStepValidationError extends Error {}

export function localized(value: unknown, locale: Locale) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Localized;
  return String(record[locale] ?? record["zh-CN"] ?? "").trim();
}

export function configuredText(configuration: Record<string, unknown> | null, key: string, locale: Locale) {
  return localized(configuration?.[key], locale);
}

export function teacherScriptSegments(node: ScriptNodeRow, locale: Locale) {
  const content = localized(node.teacher_script, locale);
  const segments = content.split(/\n\s*\n/).map((segment) => segment.trim()).filter(Boolean);
  return segments.length > 0 ? segments : [content];
}

export function studentTask(configuration: Record<string, unknown> | null) {
  const value = configuration?.studentTask;
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function visualCue(configuration: Record<string, unknown> | null) {
  const value = configuration?.visualCue;
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function virtualCharacter(configuration: Record<string, unknown> | null) {
  const value = configuration?.virtualCharacter;
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function virtualCharacterForScriptSegment(
  configuration: Record<string, unknown> | null,
  segmentIndex: number,
) {
  const character = virtualCharacter(configuration);
  if (!character || character.kind !== "uply-teacher") return null;
  const performances = Array.isArray(configuration?.scriptPerformances)
    ? configuration.scriptPerformances
    : [];
  const value = performances[segmentIndex];
  const performance = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const pose = isTeacherKimPose(performance.pose)
    ? performance.pose
    : isTeacherKimPose(character.pose)
      ? character.pose
      : "explaining";
  const position = character.position === "left" ? "left" : "right";
  const placement = normalizeTeachingVirtualCharacterPlacement(performance, position);
  const voiceLanguage = performance.voiceLanguage === "zh-CN" || performance.voiceLanguage === "ko-KR"
    ? performance.voiceLanguage
    : character.voiceLanguage === "zh-CN" || character.voiceLanguage === "ko-KR"
      ? character.voiceLanguage
      : "auto";
  const voiceRate = Number(performance.voiceRate ?? character.voiceRate);
  return {
    kind: "uply-teacher",
    pose,
    position,
    characterX: placement.x,
    characterY: placement.y,
    characterScale: placement.scale,
    dialogueX: placement.dialogueX,
    dialogueY: placement.dialogueY,
    voiceEnabled: (performance.voiceEnabled ?? character.voiceEnabled) !== false,
    voiceLanguage,
    voiceRate: Number.isFinite(voiceRate) ? Math.max(0.75, Math.min(1.25, voiceRate)) : 1,
  };
}

/**
 * Whether this script segment should automatically advance to the next one
 * once it finishes playing, instead of waiting for the student to click
 * "继续下一步". Authored per pair of adjacent 台词 lines in the script
 * editor; only ever honored in the platform-owner preview, never for real
 * students, so it can't change the paced, click-through experience they get.
 */
export function scriptSegmentAutoContinues(
  configuration: Record<string, unknown> | null,
  segmentIndex: number,
) {
  const performances = Array.isArray(configuration?.scriptPerformances)
    ? configuration.scriptPerformances
    : [];
  const value = performances[segmentIndex];
  const performance = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return performance.autoContinueToNext === true;
}

export function nodeInteraction(configuration: Record<string, unknown> | null) {
  const value = configuration?.interaction;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const interaction = value as Record<string, unknown>;
  const options = Array.isArray(interaction.options)
    ? interaction.options.filter((option): option is string => typeof option === "string" && Boolean(option.trim()))
    : [];
  if (interaction.kind !== "single_choice" || options.length < 2) return null;
  return {
    kind: "single_choice" as const,
    prompt: interaction.prompt,
    options,
    required: true,
    maxAttempts: Math.max(1, Math.min(5, Number(interaction.maxAttempts) || 3)),
  };
}

export function isTerminalScriptNode(node: ScriptNodeRow, nodes: ScriptNodeRow[]) {
  if (node.configuration?.terminal === true) return true;
  if (node.next_node_key) return false;
  return !nodes.some((candidate) => candidate.sort_order > node.sort_order);
}

/**
 * Returns the buffer line that must already be on the client before the next
 * section request starts. A multi-line section is still one section, so its
 * internal script segments never receive another buffer line.
 */
export function upcomingScriptNodeBufferLine(input: {
  selectedNode: ScriptNodeRow;
  scriptNodes: ScriptNodeRow[];
  nodeByKey: Map<string, ScriptNodeRow>;
  locale: Locale;
  segmentIndex: number;
  segmentCount: number;
}) {
  const {
    selectedNode,
    scriptNodes,
    nodeByKey,
    locale,
    segmentIndex,
    segmentCount,
  } = input;
  if (
    segmentIndex < segmentCount - 1
    || isTerminalScriptNode(selectedNode, scriptNodes)
  ) {
    return null;
  }
  const nextNode = selectedNode.next_node_key
    ? nodeByKey.get(selectedNode.next_node_key) ?? null
    : scriptNodes.find((node) => node.sort_order > selectedNode.sort_order) ?? null;
  if (!nextNode || nextNode.id === selectedNode.id) return null;
  return configuredText(nextNode.configuration, "bufferLine", locale);
}

export function upcomingScriptNode(input: {
  selectedNode: ScriptNodeRow;
  scriptNodes: ScriptNodeRow[];
  nodeByKey: Map<string, ScriptNodeRow>;
  segmentIndex: number;
  segmentCount: number;
}) {
  const { selectedNode, scriptNodes, nodeByKey, segmentIndex, segmentCount } = input;
  if (segmentIndex < segmentCount - 1 || isTerminalScriptNode(selectedNode, scriptNodes)) return null;
  const nextNode = selectedNode.next_node_key
    ? nodeByKey.get(selectedNode.next_node_key) ?? null
    : scriptNodes.find((node) => node.sort_order > selectedNode.sort_order) ?? null;
  return nextNode && nextNode.id !== selectedNode.id ? nextNode : null;
}

export async function resolveBufferLineSpeechAssetId(
  admin: AdminClient,
  node: ScriptNodeRow | null,
  locale: Locale,
  bufferLine: string,
) {
  if (!node) return null;
  const effectiveLine = bufferLine || DEFAULT_BUFFER_LINES[locale];
  const contentHash = await sha256Text(effectiveLine);
  const { data } = await admin
    .from("learning_agent_script_audio_assets")
    .select("id")
    .eq("script_node_id", node.id)
    .eq("locale", locale)
    .eq("segment_index", BUFFER_LINE_SEGMENT_INDEX)
    .eq("content_hash", contentHash)
    .eq("production_status", "ready")
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

export function taskEventKey(nodeId: string, task: Record<string, unknown>) {
  return `${nodeId}:${String(task.eventType ?? "")}:${String(task.targetKey ?? "")}`;
}

export function interactionAttempts(state: Record<string, unknown>) {
  const value = state.interactionAttempts;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as Record<string, number>;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, count]) => [
    key,
    Math.max(0, Number(count) || 0),
  ]));
}

export type ResolveScriptStepInput = {
  admin: AdminClient;
  scriptNodes: ScriptNodeRow[];
  nodeByKey: Map<string, ScriptNodeRow>;
  currentScriptNode: ScriptNodeRow | null;
  teachingState: Record<string, unknown>;
  completedTaskEvents: Set<string>;
  intent: "start" | "hint" | "example" | "ready" | "answer";
  locale: Locale;
  answer?: string;
};

export type ResolveScriptStepResult = {
  selectedScriptNode: ScriptNodeRow | null;
  /** Plain, TTS-safe text with all [b]/[u]/[color] markup stripped. */
  scriptedContent: string;
  /** Same content as scriptedContent, exploded into per-character runs so a
   * progressive reveal can keep formatting attached to each character. */
  scriptedContentRich: RichChar[];
  questionOptions: string[];
  awaitingAnswer: boolean;
  answerCorrect: boolean | null;
  nextTeachingState: Record<string, unknown>;
  selectedScriptSegmentIndex: number;
  selectedScriptSegmentCount: number;
  responseInteraction: ReturnType<typeof nodeInteraction>;
  pendingNodeAttempt: { nodeId: string; answer: string; isCorrect: boolean } | null;
  action: "none" | "focus_activity" | "play_expression";
  isFinalStep: boolean;
};

/**
 * Deterministic scripted-node traversal shared by the live student runtime and
 * the platform-owner preview runtime. Given the same nodes and state the two
 * must reach the same decision, so this owns the single copy of that logic;
 * only DB writes (session/message/attempt persistence) stay with each caller.
 */
export async function resolveScriptStep(input: ResolveScriptStepInput): Promise<ResolveScriptStepResult> {
  const { admin, scriptNodes, nodeByKey, currentScriptNode, teachingState, completedTaskEvents, intent, locale } = input;

  let selectedScriptNode: ScriptNodeRow | null = null;
  let scriptedContent = "";
  let questionOptions: string[] = [];
  let awaitingAnswer = false;
  let answerCorrect: boolean | null = null;
  let nextTeachingState = teachingState;
  let selectedScriptSegmentIndex = 0;
  let selectedScriptSegmentCount = 1;

  if (intent === "start") {
    selectedScriptNode = currentScriptNode ?? scriptNodes[0] ?? null;
  } else if (intent === "hint") {
    selectedScriptNode = currentScriptNode ?? scriptNodes[0] ?? null;
    scriptedContent = configuredText(selectedScriptNode?.configuration ?? null, "hint", locale);
  } else if (intent === "example") {
    selectedScriptNode = currentScriptNode ?? scriptNodes[0] ?? null;
    scriptedContent = configuredText(selectedScriptNode?.configuration ?? null, "example", locale);
  } else if (intent === "answer") {
    selectedScriptNode = currentScriptNode;
  } else if (currentScriptNode) {
    const currentSegments = teacherScriptSegments(currentScriptNode, locale);
    const currentSegmentIndex = teachingState.scriptSegmentNodeId === currentScriptNode.id
      ? Math.max(0, Math.min(currentSegments.length - 1, Number(teachingState.scriptSegmentIndex) || 0))
      : 0;
    if (intent === "ready" && currentSegmentIndex < currentSegments.length - 1) {
      selectedScriptNode = currentScriptNode;
      selectedScriptSegmentIndex = currentSegmentIndex + 1;
      selectedScriptSegmentCount = currentSegments.length;
      nextTeachingState = {
        ...teachingState,
        scriptSegmentNodeId: currentScriptNode.id,
        scriptSegmentIndex: selectedScriptSegmentIndex,
      };
    } else {
      const currentAnswered = teachingState.answeredNodeId === currentScriptNode.id;
      const currentStudentTask = studentTask(currentScriptNode.configuration);
      const currentInteraction = nodeInteraction(currentScriptNode.configuration);
      const requiredTaskPending = currentStudentTask?.required === true
        && !completedTaskEvents.has(taskEventKey(currentScriptNode.id, currentStudentTask));
      const currentRequiresAnswer = currentInteraction?.required === true
        || (currentScriptNode.node_type === "question" && Boolean(currentScriptNode.reference_activity_id));
      if (currentRequiresAnswer && !currentAnswered) {
        selectedScriptNode = currentScriptNode;
      } else if (intent === "ready" && requiredTaskPending) {
        selectedScriptNode = currentScriptNode;
        scriptedContent = configuredText(currentScriptNode.configuration, "taskReminder", locale)
          || (locale === "ko-KR" ? "오른쪽 학습 영역의 과제를 먼저 완료해 주세요." : "请先完成右侧学习区中的操作任务，完成后我会带你继续。 ");
      } else if (currentScriptNode.configuration?.terminal === true) {
        selectedScriptNode = currentScriptNode;
      } else {
        selectedScriptNode = currentScriptNode.next_node_key
          ? nodeByKey.get(currentScriptNode.next_node_key) ?? null
          : scriptNodes.find((node) => node.sort_order > currentScriptNode.sort_order) ?? currentScriptNode;
      }
    }
  } else {
    selectedScriptNode = scriptNodes[0] ?? null;
  }

  if (selectedScriptNode) {
    const selectedSegments = teacherScriptSegments(selectedScriptNode, locale);
    selectedScriptSegmentCount = selectedSegments.length;
    const segmentStateMatches = nextTeachingState.scriptSegmentNodeId === selectedScriptNode.id;
    selectedScriptSegmentIndex = segmentStateMatches
      ? Math.max(0, Math.min(selectedSegments.length - 1, Number(nextTeachingState.scriptSegmentIndex) || 0))
      : selectedScriptSegmentIndex;
    if (!segmentStateMatches) {
      selectedScriptSegmentIndex = 0;
      nextTeachingState = { ...nextTeachingState, scriptSegmentNodeId: selectedScriptNode.id, scriptSegmentIndex: 0 };
    }
  }

  if (selectedScriptNode && !scriptedContent && intent !== "hint" && intent !== "example") {
    scriptedContent = teacherScriptSegments(selectedScriptNode, locale)[selectedScriptSegmentIndex] ?? "";
  }

  if (selectedScriptNode && !scriptedContent && intent === "hint") {
    scriptedContent = locale === "ko-KR"
      ? "이 단계에는 아직 추가 힌트가 없어요. 현재 설명을 다시 확인해 주세요."
      : "这个教学节点暂时没有补充提示，请先回看当前讲解。";
  }

  if (selectedScriptNode && !scriptedContent && intent === "example") {
    scriptedContent = locale === "ko-KR"
      ? "이 단계에는 아직 추가 예문이 없어요. 다음 학습 단계로 넘어가 주세요."
      : "这个教学节点暂时没有补充例子，请继续完成当前学习步骤。";
  }

  const selectedInteraction = selectedScriptSegmentIndex >= selectedScriptSegmentCount - 1
    ? nodeInteraction(selectedScriptNode?.configuration ?? null)
    : null;
  const responseInteraction = selectedInteraction;
  let pendingNodeAttempt: { nodeId: string; answer: string; isCorrect: boolean } | null = null;

  if (selectedScriptNode && selectedInteraction) {
    questionOptions = selectedInteraction.options;
    if (intent === "answer") {
      if (!input.answer || !questionOptions.includes(input.answer)) {
        throw new ScriptStepValidationError("请选择一个有效回答。");
      }
      const { data: interactionSecret } = await admin
        .from("learning_agent_node_interaction_secrets")
        .select("correct_option_index,correct_feedback,incorrect_feedback")
        .eq("node_id", selectedScriptNode.id)
        .maybeSingle();
      if (!interactionSecret) {
        throw new ScriptStepValidationError("当前互动尚未配置答案，请联系课程管理员。");
      }
      const selectedIndex = questionOptions.indexOf(input.answer);
      answerCorrect = selectedIndex === Number(interactionSecret.correct_option_index);
      const previousAttemptCounts = interactionAttempts(teachingState);
      const attemptCount = (previousAttemptCounts[selectedScriptNode.id] ?? 0) + 1;
      const nextAttemptCounts = { ...previousAttemptCounts, [selectedScriptNode.id]: attemptCount };
      if (answerCorrect) {
        scriptedContent = localized(interactionSecret.correct_feedback, locale)
          || (locale === "ko-KR" ? "맞아요. 다음 단계로 가 볼까요?" : "回答得很好，我们继续下一步。 ");
        nextTeachingState = { ...teachingState, answeredNodeId: selectedScriptNode.id, answerCorrect: true, interactionAttempts: nextAttemptCounts };
      } else {
        const baseFeedback = localized(interactionSecret.incorrect_feedback, locale)
          || configuredText(selectedScriptNode.configuration, "hint", locale)
          || (locale === "ko-KR" ? "다시 생각해서 골라 보세요." : "再想一想，然后重新选择。 ");
        const reachedAttemptLimit = attemptCount >= selectedInteraction.maxAttempts;
        if (reachedAttemptLimit) {
          const correctOption = questionOptions[Number(interactionSecret.correct_option_index)] ?? "";
          scriptedContent = `${baseFeedback}${locale === "ko-KR" ? ` 정답은 ${correctOption}예요. 선생님과 확인했으니 다음 단계로 가 볼게요.` : ` 正确回答是 ${correctOption}。老师已经带你确认过了，我们继续下一步。`}`;
          nextTeachingState = { ...teachingState, answeredNodeId: selectedScriptNode.id, answerCorrect: false, interactionAttempts: nextAttemptCounts };
          awaitingAnswer = false;
        } else {
          scriptedContent = baseFeedback;
          nextTeachingState = { ...teachingState, answeredNodeId: null, answerCorrect: false, interactionAttempts: nextAttemptCounts };
          awaitingAnswer = selectedInteraction.required;
        }
      }
      pendingNodeAttempt = { nodeId: selectedScriptNode.id, answer: input.answer, isCorrect: answerCorrect };
    } else {
      awaitingAnswer = teachingState.answeredNodeId !== selectedScriptNode.id && selectedInteraction.required;
    }
  } else if (selectedScriptNode?.node_type === "question" && selectedScriptNode.reference_activity_id) {
    const [{ data: referencedActivity }, { data: activitySecret }] = await Promise.all([
      admin
        .from("digital_textbook_activities")
        .select("id,options")
        .eq("id", selectedScriptNode.reference_activity_id)
        .maybeSingle(),
      admin
        .from("digital_textbook_activity_secrets")
        .select("answer_key,explanation")
        .eq("activity_id", selectedScriptNode.reference_activity_id)
        .maybeSingle(),
    ]);
    questionOptions = Array.isArray(referencedActivity?.options)
      ? referencedActivity.options.map((option) =>
          typeof option === "string" ? option : localized(option, locale),
        ).filter(Boolean)
      : [];
    if (intent === "answer") {
      if (!input.answer) {
        throw new ScriptStepValidationError("请选择一个回答。");
      }
      const answerKey = activitySecret?.answer_key && typeof activitySecret.answer_key === "object"
        ? activitySecret.answer_key as Record<string, unknown>
        : {};
      const correctIndex = answerKey.kind === "index" ? Number(answerKey.value) : -1;
      const selectedIndex = questionOptions.indexOf(input.answer);
      answerCorrect = correctIndex >= 0 && selectedIndex === correctIndex;
      const explanation = activitySecret?.explanation && typeof activitySecret.explanation === "object"
        ? activitySecret.explanation as Record<string, unknown>
        : {};
      if (answerCorrect) {
        scriptedContent = localized(explanation.correct, locale)
          || (locale === "ko-KR" ? "맞았어요. 다음 단계로 가 볼까요?" : "回答正确。我们继续下一步。 ");
        nextTeachingState = { ...teachingState, answeredNodeId: selectedScriptNode.id, answerCorrect: true };
      } else {
        const feedback = Array.isArray(explanation.feedback) ? explanation.feedback : [];
        const remediationNode = selectedScriptNode.remediation_node_key
          ? nodeByKey.get(selectedScriptNode.remediation_node_key) ?? null
          : null;
        scriptedContent = localized(remediationNode?.teacher_script, locale)
          || localized(feedback[0], locale)
          || configuredText(selectedScriptNode.configuration, "hint", locale)
          || (locale === "ko-KR" ? "첫 번째 인사를 다시 떠올려 보세요." : "再回想一下对话的第一句。");
        nextTeachingState = { ...teachingState, answeredNodeId: null, answerCorrect: false };
        awaitingAnswer = true;
      }
      pendingNodeAttempt = { nodeId: selectedScriptNode.id, answer: input.answer, isCorrect: answerCorrect };
    } else {
      awaitingAnswer = teachingState.answeredNodeId !== selectedScriptNode.id;
    }
  }

  const action: ResolveScriptStepResult["action"] = selectedScriptNode?.action_type === "focus_activity"
    ? "focus_activity"
    : selectedScriptNode?.action_type === "play_expression"
      ? "play_expression"
      : "none";

  const isFinalStep = Boolean(
    selectedScriptNode
      && selectedScriptSegmentIndex >= selectedScriptSegmentCount - 1
      && isTerminalScriptNode(selectedScriptNode, scriptNodes)
      && !awaitingAnswer,
  );

  const scriptedContentRich = parseRichText(scriptedContent);
  scriptedContent = richCharsToPlainText(scriptedContentRich);

  return {
    selectedScriptNode,
    scriptedContent,
    scriptedContentRich,
    questionOptions,
    awaitingAnswer,
    answerCorrect,
    nextTeachingState,
    selectedScriptSegmentIndex,
    selectedScriptSegmentCount,
    responseInteraction,
    pendingNodeAttempt,
    action,
    isFinalStep,
  };
}

export async function resolveScriptCharacter(
  admin: AdminClient,
  selectedScriptNode: ScriptNodeRow | null,
  selectedScriptSegmentIndex: number,
  scriptedContent: string,
  locale: Locale,
) {
  const hint = configuredText(selectedScriptNode?.configuration ?? null, "hint", locale);
  const example = configuredText(selectedScriptNode?.configuration ?? null, "example", locale);
  const speechSegmentIndex = scriptedContent && scriptedContent === hint
    ? 197
    : scriptedContent && scriptedContent === example
      ? 198
      : selectedScriptSegmentIndex;
  const selectedCharacter = selectedScriptNode
    ? virtualCharacterForScriptSegment(selectedScriptNode.configuration, selectedScriptSegmentIndex)
    : null;
  if (selectedScriptNode && selectedCharacter && selectedCharacter.voiceEnabled !== false) {
    const exactScriptSegment = speechSegmentIndex === 197
      ? stripRichText(hint)
      : speechSegmentIndex === 198
        ? stripRichText(example)
        : stripRichText(teacherScriptSegments(selectedScriptNode, locale)[selectedScriptSegmentIndex] ?? "");
    if (exactScriptSegment && exactScriptSegment === scriptedContent) {
      const contentHash = await sha256Text(exactScriptSegment);
      const { data: speechAsset } = await admin
        .from("learning_agent_script_audio_assets")
        .select("id")
        .eq("script_node_id", selectedScriptNode.id)
        .eq("locale", locale)
        .eq("segment_index", speechSegmentIndex)
        .eq("content_hash", contentHash)
        .eq("production_status", "ready")
        .maybeSingle();
      if (speechAsset?.id) {
        return { ...selectedCharacter, speechAssetId: String(speechAsset.id) };
      }
    }
  }
  return selectedCharacter;
}

export async function sha256Text(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function headerJson(value: unknown) {
  return encodeURIComponent(JSON.stringify(value));
}
