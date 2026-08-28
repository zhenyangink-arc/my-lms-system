import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth";
import {
  canUseStudentFeature,
  normalizeMembershipTier,
  type StudentFeature,
} from "@/lib/student-permissions";
import { createAdminClient } from "@/lib/supabase/admin";

const requestSchema = z.object({
  textbookId: z.uuid(),
  moduleId: z.uuid(),
  agentCode: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  sessionId: z.uuid().optional(),
  intent: z.enum(["start", "hint", "example", "ready", "ask", "answer"]),
  locale: z.enum(["zh-CN", "ko-KR"]),
  supportMode: z.enum(["chinese", "bilingual", "immersion"]),
  message: z.string().trim().max(500).optional(),
  answer: z.string().trim().max(300).optional(),
});

type Localized = Record<string, unknown>;
type AgentAction = "none" | "focus_activity" | "play_expression" | "advance_module";
type ScriptNodeRow = {
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

const studentFeatures = new Set<StudentFeature>([
  "dashboard_section", "message_services", "learning_assignments", "korean_course",
  "ai_conversation_experience", "conversation_course", "university_target",
  "university_comparison", "application_documents", "visa_tasks", "course_preview",
  "restricted_operation",
]);

function localized(value: unknown, locale: "zh-CN" | "ko-KR") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Localized;
  return String(record[locale] ?? record["zh-CN"] ?? "").trim();
}

function configuredText(configuration: Record<string, unknown> | null, key: string, locale: "zh-CN" | "ko-KR") {
  return localized(configuration?.[key], locale);
}

function teacherScriptSegments(node: ScriptNodeRow, locale: "zh-CN" | "ko-KR") {
  const content = localized(node.teacher_script, locale);
  const segments = content.split(/\n\s*\n/).map((segment) => segment.trim()).filter(Boolean);
  return segments.length > 0 ? segments : [content];
}

function studentTask(configuration: Record<string, unknown> | null) {
  const value = configuration?.studentTask;
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function visualCue(configuration: Record<string, unknown> | null) {
  const value = configuration?.visualCue;
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nodeInteraction(configuration: Record<string, unknown> | null) {
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
    required: interaction.required !== false,
    maxAttempts: Math.max(1, Math.min(5, Number(interaction.maxAttempts) || 3)),
  };
}

function taskEventKey(nodeId: string, task: Record<string, unknown>) {
  return `${nodeId}:${String(task.eventType ?? "")}:${String(task.targetKey ?? "")}`;
}

function interactionAttempts(state: Record<string, unknown>) {
  const value = state.interactionAttempts;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as Record<string, number>;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, count]) => [
    key,
    Math.max(0, Number(count) || 0),
  ]));
}

function headerJson(value: unknown) {
  return encodeURIComponent(JSON.stringify(value));
}

function plainTextStream(content: string) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const character of Array.from(content)) {
        controller.enqueue(encoder.encode(character));
      }
      controller.close();
    },
  });
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") {
    return NextResponse.json({ error: "请先登录后再使用课程学习 Agent。" }, { status: 401 });
  }
  const role = auth.profile?.role ?? "student";
  if (
    auth.status !== "active" ||
    !auth.tenant ||
    role === "platform_course_inspector"
  ) {
    return NextResponse.json({ error: "当前账号不能使用课程学习 Agent。" }, { status: 403 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "教学请求格式不正确。" }, { status: 400 });
  }

  const input = parsed.data;
  const admin = createAdminClient();
  const { data: textbook } = await admin
    .from("digital_textbooks")
    .select("id,status,agent_profile_id")
    .eq("id", input.textbookId)
    .eq("status", "published")
    .maybeSingle();
  const { data: agentProfile } = textbook?.agent_profile_id
    ? await admin
        .from("learning_agent_profiles")
        .select("id,agent_code,display_name,access_feature,status")
        .eq("id", textbook.agent_profile_id)
        .eq("agent_code", input.agentCode)
        .eq("status", "published")
        .maybeSingle()
    : { data: null };
  const accessFeature = agentProfile?.access_feature as StudentFeature | undefined;
  if (
    !agentProfile ||
    !accessFeature ||
    !studentFeatures.has(accessFeature) ||
    !canUseStudentFeature(role, normalizeMembershipTier(auth.profile?.membership_tier), accessFeature)
  ) {
    return NextResponse.json({ error: "当前账号不能使用这位课程老师。" }, { status: 403 });
  }

  const { data: lesson } = textbook
    ? await admin
        .from("learning_agent_lessons")
        .select("id,module_id,agent_profile_id,status")
        .eq("module_id", input.moduleId)
        .eq("agent_profile_id", agentProfile.id)
        .eq("status", "published")
        .maybeSingle()
    : { data: null };
  const { data: module_ } = lesson
    ? await admin
        .from("digital_textbook_modules")
        .select("id,chapter_id,title,description")
        .eq("id", lesson.module_id)
        .maybeSingle()
    : { data: null };
  const { data: chapter } = module_
    ? await admin
        .from("digital_textbook_chapters")
        .select("id,version_id,title,status")
        .eq("id", module_.chapter_id)
        .eq("status", "published")
        .maybeSingle()
    : { data: null };
  const { data: version } = chapter
    ? await admin
        .from("digital_textbook_versions")
        .select("id,textbook_id,status")
        .eq("id", chapter.version_id)
        .eq("textbook_id", input.textbookId)
        .eq("status", "published")
        .maybeSingle()
    : { data: null };

  if (!textbook || !lesson || !module_ || !chapter || !version) {
    return NextResponse.json({ error: "当前板块的教学脚本尚未发布。" }, { status: 404 });
  }

  const stepKey = input.intent === "ask"
    ? "hint"
    : input.intent === "answer"
      ? "ready"
      : input.intent;
  const { data: step } = await admin
    .from("learning_agent_steps")
    .select("step_key,content,action_type")
    .eq("lesson_id", lesson.id)
    .eq("step_key", stepKey)
    .maybeSingle();
  if (!step) {
    return NextResponse.json({ error: "当前教学步骤尚未发布。" }, { status: 404 });
  }

  const { data: nodes } = await admin
    .from("digital_textbook_nodes")
    .select("id,sort_order,title,content")
    .eq("module_id", module_.id)
    .order("sort_order");
  const nodeIds = (nodes ?? []).map((node) => String(node.id));
  const { data: progressRows } = nodeIds.length
    ? await admin
        .from("digital_textbook_node_progress")
        .select("node_id,status,completion_percent")
        .eq("tenant_id", auth.tenant.id)
        .eq("student_id", auth.user.id)
        .eq("version_id", version.id)
        .in("node_id", nodeIds)
    : { data: [] };
  const progressByNode = new Map(
    (progressRows ?? []).map((row) => [
      String(row.node_id),
      row.status === "completed" ? 100 : Math.max(0, Math.min(100, Number(row.completion_percent) || 0)),
    ]),
  );
  const completionPercent = nodeIds.length
    ? Math.round(nodeIds.reduce((total, nodeId) => total + (progressByNode.get(nodeId) ?? 0), 0) / nodeIds.length)
    : 0;
  const targetNodeId = nodeIds.find((nodeId) => (progressByNode.get(nodeId) ?? 0) < 100) ?? null;
  const { data: targetActivities } = targetNodeId
    ? await admin
        .from("digital_textbook_activities")
        .select("id")
        .eq("node_id", targetNodeId)
        .order("sort_order")
    : { data: [] };
  const targetActivityIds = (targetActivities ?? []).map((activity) => String(activity.id));
  const { data: completedAttempts } = targetActivityIds.length
    ? await admin
        .from("digital_textbook_attempts")
        .select("activity_id")
        .eq("tenant_id", auth.tenant.id)
        .eq("student_id", auth.user.id)
        .eq("version_id", version.id)
        .in("activity_id", targetActivityIds)
    : { data: [] };
  const attemptedActivityIds = new Set((completedAttempts ?? []).map((attempt) => String(attempt.activity_id)));
  const targetActivity = (targetActivities ?? []).find((activity) => !attemptedActivityIds.has(String(activity.id)))
    ?? targetActivities?.[0]
    ?? null;

  let action: AgentAction = "none";
  if (input.intent === "ready" && completionPercent === 100) action = "advance_module";
  else if (["hint", "example", "ready"].includes(input.intent) && targetActivity) action = "focus_activity";

  const { data: currentPublishedScript } = await admin
    .from("learning_agent_script_versions")
    .select("id")
    .eq("lesson_id", lesson.id)
    .eq("status", "published")
    .maybeSingle();

  type ExistingSession = {
    id: string;
    script_version_id: string | null;
    current_node_id: string | null;
    teaching_state: Record<string, unknown> | null;
  };
  let existingSession: ExistingSession | null = null;
  if (input.sessionId) {
    const { data } = await admin
      .from("learning_agent_sessions")
      .select("id,script_version_id,current_node_id,teaching_state")
      .eq("id", input.sessionId)
      .eq("tenant_id", auth.tenant.id)
      .eq("student_id", auth.user.id)
      .eq("lesson_id", lesson.id)
      .eq("agent_profile_id", agentProfile.id)
      .maybeSingle();
    existingSession = data as ExistingSession | null;
  } else {
    const { data } = await admin
      .from("learning_agent_sessions")
      .select("id,script_version_id,current_node_id,teaching_state")
      .eq("tenant_id", auth.tenant.id)
      .eq("student_id", auth.user.id)
      .eq("lesson_id", lesson.id)
      .eq("agent_profile_id", agentProfile.id)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    existingSession = data as ExistingSession | null;
  }

  // Published teaching content is authoritative for students. An active session
  // must not remain pinned to an older script after a new version is published.
  const scriptVersionId = currentPublishedScript?.id ?? existingSession?.script_version_id ?? null;
  const scriptVersionChanged = Boolean(
    existingSession?.script_version_id
      && currentPublishedScript?.id
      && existingSession.script_version_id !== currentPublishedScript.id,
  );
  const { data: previousNodeIdentity } = scriptVersionChanged && existingSession?.current_node_id
    ? await admin
        .from("learning_agent_script_nodes")
        .select("node_key")
        .eq("id", existingSession.current_node_id)
        .maybeSingle()
    : { data: null };
  const { data: scriptNodeData } = scriptVersionId
    ? await admin
        .from("learning_agent_script_nodes")
        .select("id,script_version_id,node_key,node_type,sort_order,teacher_script,configuration,reference_activity_id,action_type,next_node_key,remediation_node_key")
        .eq("script_version_id", scriptVersionId)
        .order("sort_order")
    : { data: [] };
  const scriptNodes = (scriptNodeData ?? []) as ScriptNodeRow[];
  const nodeById = new Map(scriptNodes.map((node) => [String(node.id), node]));
  const nodeByKey = new Map(scriptNodes.map((node) => [node.node_key, node]));
  const currentScriptNode = previousNodeIdentity?.node_key
    ? nodeByKey.get(String(previousNodeIdentity.node_key)) ?? null
    : existingSession?.current_node_id
      ? nodeById.get(existingSession.current_node_id) ?? null
      : null;
  const teachingState = existingSession?.teaching_state && typeof existingSession.teaching_state === "object"
    ? existingSession.teaching_state
    : {};
  const { data: taskEventRows } = existingSession?.id
    ? await admin
        .from("learning_agent_task_events")
        .select("node_id,event_type,target_key")
        .eq("session_id", existingSession.id)
        .eq("tenant_id", auth.tenant.id)
        .eq("student_id", auth.user.id)
    : { data: [] };
  const completedTaskEvents = new Set((taskEventRows ?? []).map((event) =>
    `${String(event.node_id)}:${String(event.event_type)}:${String(event.target_key)}`,
  ));
  let selectedScriptNode: ScriptNodeRow | null = null;
  let scriptedContent = "";
  let questionOptions: string[] = [];
  let awaitingAnswer = false;
  let answerCorrect: boolean | null = null;
  let nextTeachingState = teachingState;
  let selectedScriptSegmentIndex = 0;
  let selectedScriptSegmentCount = 1;
  let responseInteraction: ReturnType<typeof nodeInteraction> = null;
  let pendingNodeAttempt: { nodeId: string; answer: string; isCorrect: boolean } | null = null;

  if (scriptNodes.length && input.intent !== "ask") {
    if (input.intent === "start") {
      selectedScriptNode = currentScriptNode ?? scriptNodes[0] ?? null;
    } else if (input.intent === "hint") {
      selectedScriptNode = currentScriptNode ?? scriptNodes[0] ?? null;
      scriptedContent = configuredText(selectedScriptNode?.configuration ?? null, "hint", input.locale);
    } else if (input.intent === "example") {
      selectedScriptNode = currentScriptNode ?? scriptNodes[0] ?? null;
      scriptedContent = configuredText(selectedScriptNode?.configuration ?? null, "example", input.locale);
    } else if (input.intent === "answer") {
      selectedScriptNode = currentScriptNode;
    } else if (currentScriptNode) {
      const currentSegments = teacherScriptSegments(currentScriptNode, input.locale);
      const currentSegmentIndex = teachingState.scriptSegmentNodeId === currentScriptNode.id
        ? Math.max(0, Math.min(currentSegments.length - 1, Number(teachingState.scriptSegmentIndex) || 0))
        : 0;
      if (input.intent === "ready" && currentSegmentIndex < currentSegments.length - 1) {
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
      if ((currentInteraction?.required === true || currentScriptNode.node_type === "question") && !currentAnswered) {
        selectedScriptNode = currentScriptNode;
      } else if (input.intent === "ready" && requiredTaskPending) {
        selectedScriptNode = currentScriptNode;
        scriptedContent = configuredText(currentScriptNode.configuration, "taskReminder", input.locale)
          || (input.locale === "ko-KR" ? "오른쪽 학습 영역의 과제를 먼저 완료해 주세요." : "请先完成右侧学习区中的操作任务，完成后我会带你继续。 ");
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
      const selectedSegments = teacherScriptSegments(selectedScriptNode, input.locale);
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

    if (
      selectedScriptNode
      && !scriptedContent
      && input.intent !== "hint"
      && input.intent !== "example"
    ) {
      scriptedContent = teacherScriptSegments(selectedScriptNode, input.locale)[selectedScriptSegmentIndex] ?? "";
    }

    if (selectedScriptNode && !scriptedContent && input.intent === "hint") {
      scriptedContent = input.locale === "ko-KR"
        ? "이 단계에는 아직 추가 힌트가 없어요. 현재 설명을 다시 확인해 주세요."
        : "这个教学节点暂时没有补充提示，请先回看当前讲解。";
    }

    if (selectedScriptNode && !scriptedContent && input.intent === "example") {
      scriptedContent = input.locale === "ko-KR"
        ? "이 단계에는 아직 추가 예문이 없어요. 다음 학습 단계로 넘어가 주세요."
        : "这个教学节点暂时没有补充例子，请继续完成当前学习步骤。";
    }

    const selectedInteraction = selectedScriptSegmentIndex >= selectedScriptSegmentCount - 1
      ? nodeInteraction(selectedScriptNode?.configuration ?? null)
      : null;
    responseInteraction = selectedInteraction;
    if (selectedScriptNode && selectedInteraction) {
      questionOptions = selectedInteraction.options;
      if (input.intent === "answer") {
        if (!input.answer || !questionOptions.includes(input.answer)) {
          return NextResponse.json({ error: "请选择一个有效回答。" }, { status: 400 });
        }
        const { data: interactionSecret } = await admin
          .from("learning_agent_node_interaction_secrets")
          .select("correct_option_index,correct_feedback,incorrect_feedback")
          .eq("node_id", selectedScriptNode.id)
          .maybeSingle();
        if (!interactionSecret) {
          return NextResponse.json({ error: "当前互动尚未配置答案，请联系课程管理员。" }, { status: 409 });
        }
        const selectedIndex = questionOptions.indexOf(input.answer);
        answerCorrect = selectedIndex === Number(interactionSecret.correct_option_index);
        const previousAttemptCounts = interactionAttempts(teachingState);
        const attemptCount = (previousAttemptCounts[selectedScriptNode.id] ?? 0) + 1;
        const nextAttemptCounts = { ...previousAttemptCounts, [selectedScriptNode.id]: attemptCount };
        if (answerCorrect) {
          scriptedContent = localized(interactionSecret.correct_feedback, input.locale)
            || (input.locale === "ko-KR" ? "맞아요. 다음 단계로 가 볼까요?" : "回答得很好，我们继续下一步。 ");
          nextTeachingState = { ...teachingState, answeredNodeId: selectedScriptNode.id, answerCorrect: true, interactionAttempts: nextAttemptCounts };
        } else {
          const baseFeedback = localized(interactionSecret.incorrect_feedback, input.locale)
            || configuredText(selectedScriptNode.configuration, "hint", input.locale)
            || (input.locale === "ko-KR" ? "다시 생각해서 골라 보세요." : "再想一想，然后重新选择。 ");
          const reachedAttemptLimit = attemptCount >= selectedInteraction.maxAttempts;
          if (reachedAttemptLimit) {
            const correctOption = questionOptions[Number(interactionSecret.correct_option_index)] ?? "";
            scriptedContent = `${baseFeedback}${input.locale === "ko-KR" ? ` 정답은 ${correctOption}예요. 선생님과 확인했으니 다음 단계로 가 볼게요.` : ` 正确回答是 ${correctOption}。老师已经带你确认过了，我们继续下一步。`}`;
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
            typeof option === "string" ? option : localized(option, input.locale),
          ).filter(Boolean)
        : [];
      if (input.intent === "answer") {
        if (!input.answer) {
          return NextResponse.json({ error: "请选择一个回答。" }, { status: 400 });
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
          scriptedContent = localized(explanation.correct, input.locale)
            || (input.locale === "ko-KR" ? "맞았어요. 다음 단계로 가 볼까요?" : "回答正确。我们继续下一步。 ");
          nextTeachingState = { ...teachingState, answeredNodeId: selectedScriptNode.id, answerCorrect: true };
        } else {
          const feedback = Array.isArray(explanation.feedback) ? explanation.feedback : [];
          const remediationNode = selectedScriptNode.remediation_node_key
            ? nodeByKey.get(selectedScriptNode.remediation_node_key) ?? null
            : null;
          scriptedContent = localized(remediationNode?.teacher_script, input.locale)
            || localized(feedback[0], input.locale)
            || configuredText(selectedScriptNode.configuration, "hint", input.locale)
            || (input.locale === "ko-KR" ? "첫 번째 인사를 다시 떠올려 보세요." : "再回想一下对话的第一句。");
          nextTeachingState = { ...teachingState, answeredNodeId: null, answerCorrect: false };
          awaitingAnswer = true;
        }
        pendingNodeAttempt = { nodeId: selectedScriptNode.id, answer: input.answer, isCorrect: answerCorrect };
      } else {
        awaitingAnswer = teachingState.answeredNodeId !== selectedScriptNode.id;
      }
    }

    if (selectedScriptNode?.action_type === "focus_activity") action = "focus_activity";
    else if (selectedScriptNode?.action_type === "play_expression") action = "play_expression";
    else action = "none";
  }

  const actionTargetActivityId = selectedScriptNode?.reference_activity_id ?? targetActivity?.id ?? null;
  // Textbook completion and scripted teaching completion are separate
  // lifecycles. A previously completed module may still have several teaching
  // nodes left, so module progress must not close the scripted session.
  const sessionStatus = scriptNodes.length === 0
    && input.intent === "ready"
    && completionPercent === 100
    ? "completed"
    : "active";
  let sessionId = existingSession?.id;
  if (!sessionId) {
    const { data: createdSession, error: sessionError } = await admin
      .from("learning_agent_sessions")
      .insert({
        tenant_id: auth.tenant.id,
        student_id: auth.user.id,
        lesson_id: lesson.id,
        agent_profile_id: agentProfile.id,
        locale: input.locale,
        support_mode: input.supportMode,
        current_step_key: step.step_key,
        last_action: { type: action, targetActivityId: actionTargetActivityId },
        script_version_id: scriptVersionId,
        current_node_id: selectedScriptNode?.id ?? null,
        teaching_state: nextTeachingState,
        status: sessionStatus,
      })
      .select("id")
      .single();
    if (sessionError || !createdSession) {
      return NextResponse.json({ error: "无法建立教学会话，请稍后重试。" }, { status: 500 });
    }
    sessionId = String(createdSession.id);
  } else {
    await admin
      .from("learning_agent_sessions")
      .update({
        locale: input.locale,
        support_mode: input.supportMode,
        current_step_key: step.step_key,
        last_action: { type: action, targetActivityId: actionTargetActivityId },
        script_version_id: scriptVersionId,
        current_node_id: selectedScriptNode?.id ?? existingSession?.current_node_id ?? null,
        teaching_state: nextTeachingState,
        status: sessionStatus,
      })
      .eq("id", sessionId);
  }

  if (pendingNodeAttempt && scriptVersionId) {
    await admin.from("learning_agent_node_attempts").insert({
      tenant_id: auth.tenant.id,
      student_id: auth.user.id,
      session_id: sessionId,
      script_version_id: scriptVersionId,
      node_id: pendingNodeAttempt.nodeId,
      response: { answer: pendingNodeAttempt.answer },
      is_correct: pendingNodeAttempt.isCorrect,
    });
  }

  const studentContent = input.message || ({
    start: "开始本节教学",
    hint: "我没听懂",
    example: "请再举一个例子",
    ready: "我准备好了",
    ask: "我有一个问题",
    answer: input.answer ? `我的回答：${input.answer}` : "提交回答",
  } as const)[input.intent];
  await admin.from("learning_agent_messages").insert({
    session_id: sessionId,
    agent_profile_id: agentProfile.id,
    role: "student",
    intent: input.intent,
    content: studentContent,
  });

  const { data: messageRows } = await admin
    .from("learning_agent_messages")
    .select("role,content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(8);
  const history = (messageRows ?? []).reverse().slice(0, -1).map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: String(message.content),
  }));

  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "private, no-store, max-age=0",
    "X-Learning-Agent-Session": sessionId,
    "X-Learning-Agent-Action": action,
    "X-Learning-Agent-Target-Activity": actionTargetActivityId ?? "",
    "X-Learning-Agent-Progress": String(completionPercent),
  });
  if (selectedScriptNode) {
    const selectedStudentTask = studentTask(selectedScriptNode.configuration);
    const selectedTaskCompleted = selectedStudentTask
      ? completedTaskEvents.has(taskEventKey(selectedScriptNode.id, selectedStudentTask))
      : false;
    headers.set("X-Learning-Agent-Script-Node", selectedScriptNode.node_key);
    headers.set("X-Learning-Agent-Script-Node-Type", selectedScriptNode.node_type);
    headers.set(
      "X-Learning-Agent-Display",
      headerJson(selectedScriptNode.configuration?.display ?? null),
    );
    headers.set("X-Learning-Agent-Task", headerJson(selectedStudentTask));
    headers.set("X-Learning-Agent-Interaction", headerJson(responseInteraction));
    headers.set(
      "X-Learning-Agent-Visual-Cue",
      headerJson(input.intent === "start" || input.intent === "ready"
        ? visualCue(selectedScriptNode.configuration)
        : null),
    );
    headers.set("X-Learning-Agent-Task-Completed", selectedTaskCompleted ? "true" : "false");
    headers.set("X-Learning-Agent-Question-Options", headerJson(questionOptions));
    headers.set("X-Learning-Agent-Awaiting-Answer", awaitingAnswer ? "true" : "false");
    if (answerCorrect !== null) {
      headers.set("X-Learning-Agent-Answer-Correct", answerCorrect ? "true" : "false");
    }
    headers.set(
      "X-Learning-Agent-Terminal",
      selectedScriptSegmentIndex >= selectedScriptSegmentCount - 1 && selectedScriptNode.configuration?.terminal === true ? "true" : "false",
    );
    headers.set(
      "X-Learning-Agent-Continue-Label",
      encodeURIComponent(selectedScriptSegmentIndex < selectedScriptSegmentCount - 1
        ? (input.locale === "ko-KR" ? "다음 대사" : "继续下一句")
        : configuredText(selectedScriptNode.configuration, "continueLabel", input.locale)),
    );
  }

  const fallback = scriptedContent || localized(step.content, input.locale);
  if (selectedScriptNode && scriptedContent && input.intent !== "ask") {
    await admin.from("learning_agent_messages").insert({
      session_id: sessionId,
      agent_profile_id: agentProfile.id,
      role: "assistant",
      content: scriptedContent.slice(0, 4000),
      action: { type: action, targetActivityId: actionTargetActivityId },
      provider: "scripted",
    });
    headers.set("X-Learning-Agent-Mode", "scripted");
    return new Response(plainTextStream(scriptedContent), { headers });
  }
  const { data: { session } } = await auth.supabase.auth.getSession();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!session?.access_token || !supabaseUrl || !publishableKey) {
    await admin.from("learning_agent_messages").insert({
      session_id: sessionId,
      agent_profile_id: agentProfile.id,
      role: "assistant",
      content: fallback,
      action: { type: action, targetActivityId: actionTargetActivityId },
      provider: "scripted",
    });
    headers.set("X-Learning-Agent-Mode", "scripted");
    return new Response(plainTextStream(fallback), { headers });
  }

  const upstream = await fetch(`${supabaseUrl}/functions/v1/learning-agent-runtime`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agentCode: agentProfile.agent_code,
      locale: input.locale,
      supportMode: input.supportMode,
      intent: input.intent,
      chapterTitle: localized(chapter.title, input.locale),
      moduleTitle: localized(module_.title, input.locale),
      moduleGoal: localized(module_.description, input.locale),
      script: fallback,
      publishedContext: JSON.stringify((nodes ?? []).map((node) => ({
        title: localized(node.title, input.locale),
        content: node.content,
      }))).slice(0, 6000),
      studentMessage: input.message,
      completionPercent,
      history,
    }),
    cache: "no-store",
  }).catch(() => null);

  if (!upstream?.ok || !upstream.body) {
    await admin.from("learning_agent_messages").insert({
      session_id: sessionId,
      agent_profile_id: agentProfile.id,
      role: "assistant",
      content: fallback,
      action: { type: action, targetActivityId: actionTargetActivityId },
      provider: "scripted",
    });
    headers.set("X-Learning-Agent-Mode", "scripted");
    return new Response(plainTextStream(fallback), { headers });
  }

  const provider = upstream.headers.get("X-Learning-Agent-Provider") ?? "configured";
  const model = upstream.headers.get("X-Learning-Agent-Model");
  headers.set("X-Learning-Agent-Mode", "model");
  const decoder = new TextDecoder();
  let assistantContent = "";
  const streamedBody = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantContent += decoder.decode(value, { stream: true });
          controller.enqueue(value);
        }
        assistantContent += decoder.decode();
        const savedContent = assistantContent.trim() || fallback;
        await admin.from("learning_agent_messages").insert({
          session_id: sessionId,
          agent_profile_id: agentProfile.id,
          role: "assistant",
          content: savedContent.slice(0, 4000),
          action: { type: action, targetActivityId: actionTargetActivityId },
          provider,
          model,
        });
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });

  return new Response(streamedBody, { headers });
}
