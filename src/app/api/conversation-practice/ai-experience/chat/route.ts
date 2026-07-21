import { NextResponse } from "next/server";


type ChatRole = "user" | "assistant";

type ChatHistoryItem = {
  role: ChatRole;
  content: string;
};

type ChatRequestBody = {
  message?: unknown;
  history?: unknown;
  sessionId?: unknown;
};

const DEFAULT_AI_SERVER_URL = "http://100.125.173.55:8000";
const MAX_MESSAGE_LENGTH = 800;
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

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history: upstreamHistory }),
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

    return NextResponse.json({ reply, sessionId });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    return NextResponse.json(
      { error: timedOut ? "AI 陪练老师思考时间过长，请重新发送。" : "暂时无法连接 AI 陪练服务。" },
      { status: 502 }
    );
  }
}
