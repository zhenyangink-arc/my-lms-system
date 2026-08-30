import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthContext } from "@/lib/auth";
import {
  configuredText,
  headerJson,
  isTerminalScriptNode,
  localized,
  resolveScriptCharacter,
  resolveScriptStep,
  ScriptStepValidationError,
  studentTask,
  taskEventKey,
  visualCue,
  type ScriptNodeRow,
} from "@/lib/learning-agent-script-runtime";
import type { RichChar } from "@/lib/rich-teaching-text";
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
  restart: z.boolean().optional(),
  intent: z.enum(["start", "hint", "example", "ready", "ask", "answer"]),
  locale: z.enum(["zh-CN", "ko-KR"]),
  supportMode: z.enum(["chinese", "bilingual", "immersion"]),
  message: z.string().trim().max(500).optional(),
  answer: z.string().trim().max(300).optional(),
});

type AgentAction = "none" | "focus_activity" | "play_expression" | "advance_module";

const studentFeatures = new Set<StudentFeature>([
  "dashboard_section", "message_services", "learning_assignments", "korean_course",
  "ai_conversation_experience", "conversation_course", "university_target",
  "university_comparison", "application_documents", "visa_tasks", "course_preview",
  "restricted_operation",
]);

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

  if (input.restart && existingSession) {
    await admin
      .from("learning_agent_sessions")
      .update({ status: "abandoned" })
      .eq("id", existingSession.id)
      .eq("tenant_id", auth.tenant.id)
      .eq("student_id", auth.user.id);
    existingSession = null;
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
  let scriptedContentRich: RichChar[] = [];
  let questionOptions: string[] = [];
  let awaitingAnswer = false;
  let answerCorrect: boolean | null = null;
  let nextTeachingState = teachingState;
  let selectedScriptSegmentIndex = 0;
  let selectedScriptSegmentCount = 1;
  let responseInteraction: Awaited<ReturnType<typeof resolveScriptStep>>["responseInteraction"] = null;
  let pendingNodeAttempt: { nodeId: string; answer: string; isCorrect: boolean } | null = null;
  let scriptedSessionCompleted = false;

  if (scriptNodes.length && input.intent !== "ask") {
    try {
      const resolved = await resolveScriptStep({
        admin,
        scriptNodes,
        nodeByKey,
        currentScriptNode,
        teachingState,
        completedTaskEvents,
        intent: input.intent,
        locale: input.locale,
        answer: input.answer,
      });
      selectedScriptNode = resolved.selectedScriptNode;
      scriptedContent = resolved.scriptedContent;
      scriptedContentRich = resolved.scriptedContentRich;
      questionOptions = resolved.questionOptions;
      awaitingAnswer = resolved.awaitingAnswer;
      answerCorrect = resolved.answerCorrect;
      nextTeachingState = resolved.nextTeachingState;
      selectedScriptSegmentIndex = resolved.selectedScriptSegmentIndex;
      selectedScriptSegmentCount = resolved.selectedScriptSegmentCount;
      responseInteraction = resolved.responseInteraction;
      pendingNodeAttempt = resolved.pendingNodeAttempt;
      action = resolved.action;
      scriptedSessionCompleted = resolved.isFinalStep
        && (!studentTask(selectedScriptNode?.configuration ?? null)?.required
          || completedTaskEvents.has(taskEventKey(
            selectedScriptNode?.id ?? "",
            studentTask(selectedScriptNode?.configuration ?? null) ?? {},
          )));
    } catch (error) {
      if (error instanceof ScriptStepValidationError) {
        return NextResponse.json({ error: error.message }, { status: error.message.includes("联系课程管理员") ? 409 : 400 });
      }
      throw error;
    }
  }

  const actionTargetActivityId = selectedScriptNode?.reference_activity_id ?? targetActivity?.id ?? null;
  // Textbook completion and scripted teaching completion are separate
  // lifecycles. A previously completed module may still have several teaching
  // nodes left, so module progress must not close the scripted session.
  const sessionStatus = scriptNodes.length > 0
    ? scriptedSessionCompleted ? "completed" : "active"
    : input.intent === "ready" && completionPercent === 100
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

  const selectedCharacter = selectedScriptNode
    ? await resolveScriptCharacter(admin, selectedScriptNode, selectedScriptSegmentIndex, scriptedContent, input.locale)
    : null;

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
    headers.set(
      "X-Learning-Agent-Character",
      headerJson(selectedCharacter),
    );
    headers.set("X-Learning-Agent-Interaction", headerJson(responseInteraction));
    headers.set(
      "X-Learning-Agent-Visual-Cue",
      headerJson(input.intent === "start" || input.intent === "ready"
        ? visualCue(selectedScriptNode.configuration)
        : null),
    );
    headers.set("X-Learning-Agent-Task-Completed", selectedTaskCompleted ? "true" : "false");
    headers.set("X-Learning-Agent-Question-Options", headerJson(questionOptions));
    headers.set("X-Learning-Agent-Script-Rich", headerJson(scriptedContentRich));
    headers.set("X-Learning-Agent-Awaiting-Answer", awaitingAnswer ? "true" : "false");
    if (answerCorrect !== null) {
      headers.set("X-Learning-Agent-Answer-Correct", answerCorrect ? "true" : "false");
    }
    headers.set(
      "X-Learning-Agent-Terminal",
      selectedScriptSegmentIndex >= selectedScriptSegmentCount - 1
        && isTerminalScriptNode(selectedScriptNode, scriptNodes)
        && !awaitingAnswer
        ? "true"
        : "false",
    );
    headers.set(
      "X-Learning-Agent-Continue-Label",
      encodeURIComponent(selectedScriptSegmentIndex < selectedScriptSegmentCount - 1
        ? (input.locale === "ko-KR" ? "다음 대사" : "继续下一句")
        : configuredText(selectedScriptNode.configuration, "continueLabel", input.locale)),
    );
    headers.set(
      "X-Learning-Agent-Buffer-Line",
      encodeURIComponent(configuredText(selectedScriptNode.configuration, "bufferLine", input.locale)),
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
