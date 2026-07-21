import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";


type ChatRole = "user" | "assistant";

type ChatHistoryItem = {
  role: ChatRole;
  content: string;
};

type ChatRequestBody = {
  message?: unknown;
  history?: unknown;
  replyLanguageMode?: unknown;
};

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_ITEMS = 12;

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

export async function POST(request: Request) {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "请求内容格式不正确。" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const replyLanguageMode = body.replyLanguageMode === "korean" || body.replyLanguageMode === "beginner" ? body.replyLanguageMode : "match";
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `请输入 1 到 ${MAX_MESSAGE_LENGTH} 个字符的内容。` }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "请先登录后再使用 AI 口语陪练。" }, { status: 401 });
  }

  const { data: { session } } = await supabase.auth.getSession();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!session?.access_token || !supabaseUrl || !publishableKey) {
    return NextResponse.json({ error: "AI 服务认证尚未准备就绪，请重新登录后再试。" }, { status: 401 });
  }

  const upstream = await fetch(`${supabaseUrl}/functions/v1/qwen-conversation-chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, history: normalizeHistory(body.history), replyLanguageMode }),
    cache: "no-store",
  });

  if (!upstream.ok || !upstream.body) {
    const result = await upstream.json().catch(() => null) as { error?: unknown } | null;
    return NextResponse.json(
      { error: typeof result?.error === "string" ? result.error : "AI 服务暂时不可用，请稍后再试。" },
      { status: upstream.status || 502 }
    );
  }

  return new Response(upstream.body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
