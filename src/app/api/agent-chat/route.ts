import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";
import { getGuideAgentStudentContext } from "@/lib/guide-agent-progress";
import {
  resolveGuideHighlightTarget,
  resolveGuideNavigationTarget,
} from "@/lib/guide-agent-targets";
import { createAdminClient } from "@/lib/supabase/admin";

type AgentChatRequestBody = {
  message?: unknown;
  student_id?: unknown;
  conversation_id?: unknown;
};

type ResolvedAgentAction =
  | { action: "navigate"; target: string }
  | { action: "highlight"; target: string; path?: string };

const GUIDE_AGENT_CODE = "uply-guide-agent";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const streamEncoder = new TextEncoder();

function encodeStreamFrame(value: Record<string, unknown>) {
  return streamEncoder.encode(`${JSON.stringify(value)}\n`);
}

function sanitizeAnswer(value: string) {
  return value
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "")
    .replace(/<think\b[^>]*>[\s\S]*$/gi, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function inferGuideActions(message: string): ResolvedAgentAction[] {
  const wantsHighlight = /在哪|哪里|位置|找到|找一下|指出|高亮|标出来/.test(message);
  const wantsNavigation = /打开|前往|进入|跳转|带我去|我要去|去看看|查看/.test(message);
  const highlight = resolveGuideHighlightTarget(message);
  if (wantsHighlight && highlight) {
    return [{
      action: "highlight",
      target: highlight.elementId,
      ...(highlight.path ? { path: highlight.path } : {}),
    }];
  }
  const navigation = resolveGuideNavigationTarget(message);
  if ((wantsNavigation || wantsHighlight) && navigation) {
    return [{ action: "navigate", target: navigation }];
  }
  return [];
}

function currentPath(request: Request) {
  const referer = request.headers.get("referer");
  if (!referer) return "/dashboard";
  try {
    const url = new URL(referer);
    return `${url.pathname}${url.search}${url.hash}`.slice(0, 500);
  } catch {
    return "/dashboard";
  }
}

export async function POST(request: Request) {
  const parsedBody = await request.json().catch(() => null);
  if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
    return NextResponse.json({ error: "请求内容格式不正确。" }, { status: 400 });
  }
  const body = parsedBody as AgentChatRequestBody;
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  const studentId = typeof body.student_id === "string" ? body.student_id.trim() : "";
  if (!message || !studentId) {
    return NextResponse.json({ error: "请输入要咨询的问题。" }, { status: 400 });
  }

  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") {
    return NextResponse.json({ error: "请先登录后再使用导航助手。" }, { status: 401 });
  }
  if (
    auth.status !== "active" ||
    auth.user.id !== studentId ||
    !auth.tenant
  ) {
    return NextResponse.json({ error: "当前账号不能使用导航助手。" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("learning_agent_profiles")
    .select("id,agent_code,status")
    .eq("agent_code", GUIDE_AGENT_CODE)
    .eq("status", "published")
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "UPLY 导航助手尚未发布。" }, { status: 503 });
  }

  const requestedConversationId =
    typeof body.conversation_id === "string" && UUID_PATTERN.test(body.conversation_id.trim())
      ? body.conversation_id.trim()
      : "";
  const { data: existingSession } = requestedConversationId
    ? await admin
        .from("guide_agent_sessions")
        .select("id")
        .eq("id", requestedConversationId)
        .eq("tenant_id", auth.tenant.id)
        .eq("student_id", auth.user.id)
        .eq("agent_profile_id", profile.id)
        .eq("status", "active")
        .maybeSingle()
    : { data: null };
  let sessionId = existingSession?.id as string | undefined;
  if (!sessionId) {
    const { data: createdSession, error: sessionError } = await admin
      .from("guide_agent_sessions")
      .insert({
        tenant_id: auth.tenant.id,
        student_id: auth.user.id,
        agent_profile_id: profile.id,
      })
      .select("id")
      .single();
    if (sessionError || !createdSession) {
      return NextResponse.json({ error: "暂时无法建立导航助手会话。" }, { status: 500 });
    }
    sessionId = String(createdSession.id);
  }

  const [{ data: historyRows }, studentContext] = await Promise.all([
    admin
      .from("guide_agent_messages")
      .select("role,content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(10),
    getGuideAgentStudentContext({
      studentId: auth.user.id,
      tenantId: auth.tenant.id,
    }),
  ]);
  const history = (historyRows ?? []).reverse().map((item) => ({
    role: item.role === "assistant" ? "assistant" : "user",
    content: String(item.content),
  }));
  const { error: userMessageError } = await admin
    .from("guide_agent_messages")
    .insert({ session_id: sessionId, role: "user", content: message });
  if (userMessageError) {
    return NextResponse.json({ error: "暂时无法保存本次咨询。" }, { status: 500 });
  }

  const { data: { session } } = await auth.supabase.auth.getSession();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!session?.access_token || !supabaseUrl || !publishableKey) {
    return NextResponse.json({ error: "导航助手运行环境尚未配置。" }, { status: 503 });
  }

  const upstream = await fetch(`${supabaseUrl}/functions/v1/guide-agent-runtime`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agentCode: GUIDE_AGENT_CODE,
      message,
      currentPath: currentPath(request),
      studentContext: JSON.stringify(studentContext),
      history,
    }),
    cache: "no-store",
  }).catch(() => null);
  if (!upstream?.ok || !upstream.body) {
    const details = upstream ? await upstream.text().catch(() => "") : "";
    console.error("[guide-agent] Runtime unavailable", {
      status: upstream?.status,
      details: details.slice(0, 500),
    });
    return NextResponse.json({ error: "导航助手暂时没有响应，请稍后再试。" }, { status: 502 });
  }

  const provider = upstream.headers.get("X-Guide-Agent-Provider") ?? "configured";
  const model = upstream.headers.get("X-Guide-Agent-Model");
  const actions = inferGuideActions(message);
  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let rawAnswer = "";
      let lastAnswer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          rawAnswer += decoder.decode(value, { stream: true });
          const answer = sanitizeAnswer(rawAnswer);
          if (answer && answer !== lastAnswer) {
            lastAnswer = answer;
            controller.enqueue(encodeStreamFrame({ type: "answer", answer }));
          }
        }
        rawAnswer += decoder.decode();
        const answer = sanitizeAnswer(rawAnswer);
        if (!answer) throw new Error("导航助手返回了空内容。");
        await admin.from("guide_agent_messages").insert({
          session_id: sessionId,
          role: "assistant",
          content: answer.slice(0, 4000),
          actions,
          provider,
          model,
        });
        await admin
          .from("guide_agent_sessions")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", sessionId);
        controller.enqueue(encodeStreamFrame({
          type: "done",
          answer,
          conversation_id: sessionId,
          actions,
        }));
        controller.close();
      } catch (error) {
        console.error("[guide-agent] Failed while streaming response", error);
        controller.enqueue(encodeStreamFrame({
          type: "error",
          error: "导航助手回复中断，请再试一次。",
        }));
        controller.close();
      } finally {
        reader.releaseLock();
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no",
      "X-Guide-Agent-Session": sessionId,
    },
  });
}
