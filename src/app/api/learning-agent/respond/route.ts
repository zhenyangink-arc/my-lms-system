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
  intent: z.enum(["start", "hint", "example", "ready", "ask"]),
  locale: z.enum(["zh-CN", "ko-KR"]),
  supportMode: z.enum(["chinese", "bilingual", "immersion"]),
  message: z.string().trim().max(500).optional(),
});

type Localized = Record<string, unknown>;
type AgentAction = "none" | "focus_activity" | "advance_module";

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

  const stepKey = input.intent === "ask" ? "hint" : input.intent;
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

  let sessionId = input.sessionId;
  if (sessionId) {
    const { data: existingSession } = await admin
      .from("learning_agent_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("tenant_id", auth.tenant.id)
      .eq("student_id", auth.user.id)
      .eq("lesson_id", lesson.id)
      .eq("agent_profile_id", agentProfile.id)
      .eq("status", "active")
      .maybeSingle();
    if (!existingSession) sessionId = undefined;
  }
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
        last_action: { type: action, targetActivityId: targetActivity?.id ?? null },
        status: input.intent === "ready" && completionPercent === 100 ? "completed" : "active",
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
        last_action: { type: action, targetActivityId: targetActivity?.id ?? null },
        status: input.intent === "ready" && completionPercent === 100 ? "completed" : "active",
      })
      .eq("id", sessionId);
  }

  const studentContent = input.message || ({
    start: "开始本节教学",
    hint: "我没听懂",
    example: "请再举一个例子",
    ready: "我准备好了",
    ask: "我有一个问题",
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
    "X-Learning-Agent-Target-Activity": targetActivity?.id ?? "",
    "X-Learning-Agent-Progress": String(completionPercent),
  });
  const fallback = localized(step.content, input.locale);
  const { data: { session } } = await auth.supabase.auth.getSession();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!session?.access_token || !supabaseUrl || !publishableKey) {
    await admin.from("learning_agent_messages").insert({
      session_id: sessionId,
      agent_profile_id: agentProfile.id,
      role: "assistant",
      content: fallback,
      action: { type: action, targetActivityId: targetActivity?.id ?? null },
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
      action: { type: action, targetActivityId: targetActivity?.id ?? null },
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
          action: { type: action, targetActivityId: targetActivity?.id ?? null },
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
