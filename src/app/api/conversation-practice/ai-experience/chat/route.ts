import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";
import {
  canUseStudentFeature,
  normalizeMembershipTier,
} from "@/lib/student-permissions";
import { createAdminClient } from "@/lib/supabase/admin";

type ChatRole = "user" | "assistant";

type ChatHistoryItem = {
  role: ChatRole;
  content: string;
};

type ChatRequestBody = {
  message?: unknown;
  history?: unknown;
  sessionId?: unknown;
  replyLanguageMode?: unknown;
};

const DEFAULT_AI_SERVER_URL = "http://100.125.173.55:8000";
const MAX_MESSAGE_LENGTH = 800;
const MAX_HISTORY_ITEMS = 12;
const USAGE_MODEL_LABEL = "conversation_voice_image";
// 语音/图片版陪练走的是自托管外部服务，没有 DashScope 那样天然的按 token 计费和上游鉴权，
// 这里的每日上限是本地兜底配额：即使上游 URL 被泄露或绕过登录直接访问，
// 通过本代理转发的合法登录用户每天也有硬上限，防止单个账号无限调用消耗成本。
const DAILY_MESSAGE_LIMIT = Number(process.env.CONVERSATION_AI_DAILY_MESSAGE_LIMIT ?? 200);
const ROLLING_WINDOW_MS = 24 * 60 * 60 * 1000;

function normalizeHistory(value: unknown): ChatHistoryItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      role: item.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: typeof item.content === "string" ? item.content.trim().slice(0, MAX_MESSAGE_LENGTH) : "",
    }))
    .filter((item) => item.content.length > 0)
    .slice(-MAX_HISTORY_ITEMS);
}

function extractReply(payload: unknown) {
  if (typeof payload === "string") return payload.trim();
  if (!payload || typeof payload !== "object") return "";

  const record = payload as Record<string, unknown>;
  for (const key of ["reply", "response", "answer", "content", "text"] as const) {
    if (typeof record[key] === "string" && record[key].trim()) {
      return record[key].trim();
    }
  }

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message.trim();
  }

  if (record.message && typeof record.message === "object") {
    const message = record.message as Record<string, unknown>;
    if (typeof message.content === "string" && message.content.trim()) {
      return message.content.trim();
    }
  }

  if (Array.isArray(record.choices)) {
    const firstChoice = record.choices[0];
    if (firstChoice && typeof firstChoice === "object") {
      const choice = firstChoice as Record<string, unknown>;
      if (typeof choice.text === "string" && choice.text.trim()) return choice.text.trim();

      if (choice.message && typeof choice.message === "object") {
        const choiceMessage = choice.message as Record<string, unknown>;
        if (typeof choiceMessage.content === "string" && choiceMessage.content.trim()) {
          return choiceMessage.content.trim();
        }
      }
    }
  }

  return "";
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") {
    return NextResponse.json({ error: "请先登录后再使用 AI 口语陪练。" }, { status: 401 });
  }
  const role = auth.profile?.role ?? "student";
  // canUseStudentFeature 对巡检员一律放行（方便巡查课程内容），但这是按次计费的
  // 外部 AI 语音服务，巡检员应该是"只读"，不该无限次消耗真实成本。
  if (role === "platform_course_inspector") {
    return NextResponse.json({ error: "课程巡检员为只读模式，不能使用 AI 口语陪练。" }, { status: 403 });
  }
  if (
    auth.status !== "active" ||
    !canUseStudentFeature(
      role,
      normalizeMembershipTier(auth.profile?.membership_tier),
      "ai_conversation_experience"
    )
  ) {
    return NextResponse.json({ error: "当前会员档位没有 AI 交流体验权限。" }, { status: 403 });
  }

  const userId = auth.user.id;
  const tenantId = auth.tenant?.id;
  if (!tenantId) {
    return NextResponse.json({ error: "当前账号没有可用的学习空间。" }, { status: 403 });
  }
  const admin = createAdminClient();
  const windowStartIso = new Date(Date.now() - ROLLING_WINDOW_MS).toISOString();
  const { count: usedInWindow, error: usageCheckError } = await admin
    .from("ai_token_usage")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("model", USAGE_MODEL_LABEL)
    .gte("created_at", windowStartIso);

  if (!usageCheckError && (usedInWindow ?? 0) >= DAILY_MESSAGE_LIMIT) {
    return NextResponse.json(
      { error: "今日 AI 口语陪练使用次数已达上限，请明天再试或联系管理员。" },
      { status: 429 }
    );
  }

  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "请求内容格式不正确。" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "请输入要练习的内容。" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `每次消息不能超过 ${MAX_MESSAGE_LENGTH} 个字符。` },
      { status: 400 }
    );
  }
  const replyLanguageMode =
    body.replyLanguageMode === "korean" || body.replyLanguageMode === "beginner"
      ? body.replyLanguageMode
      : "match";

  const history = normalizeHistory(body.history);
  const latestHistoryItem = history.at(-1);
  const upstreamHistory =
    latestHistoryItem?.role === "user" && latestHistoryItem.content === message
      ? history.slice(0, -1)
      : history;
  const sessionId =
    typeof body.sessionId === "string" ? body.sessionId.trim().slice(0, 120) : undefined;

  const serverUrl =
    process.env.CONVERSATION_AI_BASE_URL ??
    process.env.CONVERSATION_AI_SERVER_URL ??
    DEFAULT_AI_SERVER_URL;
  const chatPath = process.env.CONVERSATION_AI_CHAT_PATH ?? "/chat";

  let endpoint: URL;
  try {
    endpoint = new URL(chatPath, serverUrl.endsWith("/") ? serverUrl : `${serverUrl}/`);
  } catch {
    return NextResponse.json({ error: "AI 陪练服务地址配置不正确。" }, { status: 500 });
  }

  // 上游是自托管服务，不像 DashScope 那样天然要求调用方鉴权；这里始终携带共享密钥，
  // 但真正堵住"拿到 URL 绕过登录直接调用"的口子，还需要上游服务自己校验这个头部
  // （或在网络层只放行本服务器出口）——这两处都不在本仓库范围内，需要运维配合。
  const serviceToken = process.env.CONVERSATION_AI_SERVICE_TOKEN;

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(serviceToken ? { Authorization: `Bearer ${serviceToken}` } : {}),
      },
      body: JSON.stringify({ message, history: upstreamHistory, replyLanguageMode }),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });

    if (!upstream.ok) {
      const endpointMissing = upstream.status === 404 || upstream.status === 405;
      return NextResponse.json(
        {
          error: endpointMissing
            ? "AI 陪练服务已连接，但聊天接口尚未开放，请检查服务端聊天接口配置。"
            : "AI 陪练老师暂时没有响应，请稍后再试。",
        },
        { status: 502 }
      );
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await upstream.json()
      : await upstream.text();
    const reply = extractReply(payload);

    if (!reply) {
      return NextResponse.json(
        { error: "AI 陪练服务已返回结果，但没有找到可展示的回复文字。" },
        { status: 502 }
      );
    }

    // 自托管服务不像 DashScope 那样按 usage 字段回传 token 数，这里用字符数做
    // 粗略估算，只用于配额计数和成本可见性，不代表精确计费口径。
    // 这条记录同时是每日配额计数的依据——之前写失败会被完全吞掉，用户实际上
    // 能借着"用量记录一直写不进去"无限绕过每日上限，所以这里至少要把失败记下来。
    const { error: usageInsertError } = await admin.from("ai_token_usage").insert({
      tenant_id: tenantId,
      user_id: userId,
      provider: "self_hosted",
      model: USAGE_MODEL_LABEL,
      feature_code: "ai_conversation_experience",
      input_tokens: message.length,
      output_tokens: reply.length,
      total_tokens: message.length + reply.length,
    });
    if (usageInsertError) {
      console.error("[conversation-practice/chat] Failed to record AI usage", {
        userId,
        error: usageInsertError,
      });
    }

    return NextResponse.json({ reply, sessionId });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    return NextResponse.json(
      { error: timedOut ? "AI 陪练老师思考时间过长，请重新发送。" : "暂时无法连接 AI 陪练服务。" },
      { status: 502 }
    );
  }
}
