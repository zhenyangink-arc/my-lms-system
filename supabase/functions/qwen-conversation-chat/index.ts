type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_ITEMS = 12;
const DASHSCOPE_CHAT_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

const SYSTEM_PROMPT = `你是一位专业、耐心的韩语口语陪练老师。

回复语言必须与用户最新一条消息的主要语言一致：
- 用户主要用中文提问时，只用中文回复；不要夹带韩语、括号翻译或双语对照。
- 用户主要用韩语提问时，只用韩语回复；不要夹带中文、括号翻译或双语对照。
- 用户明确要求翻译、对照或指定另一种语言时，才按用户的明确要求回复。

身份说明：你是本平台的 AI 韩语口语陪练，帮助学生进行韩语表达和情景对话练习。用户询问“你是什么模型”“谁开发的”“你是不是某某模型”等身份或技术实现问题时，只说明上述产品身份；不要透露、猜测或确认底层模型、供应商、公司或技术架构。可简短回答：“我是本平台的 AI 韩语口语陪练，专注陪你练习韩语表达和日常对话。”

篇幅要求：普通对话的单次回复不得超过 150 个字符。仅当用户明确是在写作文、计划书、申请文书或其他长文本，并明确指定篇幅时，才按其指定篇幅生成；指定篇幅最高为 1000 个字符，不得超过。没有明确指定篇幅的长文本请求仍按普通对话限制回复。

保持自然、简洁。只有当用户使用韩语且存在明显表达问题时，才用韩语简要纠正，并给出更自然的说法和一小段可继续对话的回复。`;

function getReplyLimit(message: string): number {
  const isLongFormRequest = /作文|计划书|計劃書|申请文书|申请书|写作|文章|작문|글쓰기|계획서|자기소개서/i.test(message);
  const requestedLength = message.match(/(?:约|大约|不少于|不超过|最多|至少)?\s*(\d{1,4})\s*(?:字|个字|字符|词|单词|words?|characters?|자|단어)/i);

  if (!isLongFormRequest || !requestedLength) return 150;
  return Math.max(1, Math.min(Number(requestedLength[1]), 1000));
}

function limitReply(reply: string, maxLength: number): string {
  const characters = Array.from(reply.trim());
  return characters.length <= maxLength ? reply.trim() : characters.slice(0, maxLength).join("").trim();
}

function getUserId(request: Request) {
  try { return JSON.parse(atob((request.headers.get("authorization") ?? "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub as string | undefined; } catch { return undefined; }
}

function recordUsage(userId: string | undefined, usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }) {
  const url = Deno.env.get("SUPABASE_URL"); const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  void fetch(`${url}/rest/v1/ai_token_usage`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ user_id: userId ?? null, model: Deno.env.get("QWEN_MODEL") ?? "qwen3.7-plus", input_tokens: usage.prompt_tokens ?? 0, output_tokens: usage.completion_tokens ?? 0, total_tokens: usage.total_tokens ?? 0 }) });
}

function streamReply(upstream: Response, maxLength: number, userId: string | undefined) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let emittedLength = 0;
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body?.getReader();
      if (!reader) {
        controller.error(new Error("Qwen response stream is unavailable"));
        return;
      }

      const emit = (text: string) => {
        const remaining = maxLength - emittedLength;
        if (remaining <= 0) return false;
        const chunk = Array.from(text).slice(0, remaining).join("");
        if (!chunk) return true;
        emittedLength += Array.from(chunk).length;
        controller.enqueue(encoder.encode(chunk));
        return emittedLength < maxLength;
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            const data = event.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            const payload = JSON.parse(data) as { choices?: Array<{ delta?: { content?: unknown } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
            if (payload.usage) recordUsage(userId, payload.usage);
            const content = payload.choices?.[0]?.delta?.content;
            if (typeof content === "string" && !emit(content)) {
              await reader.cancel();
              controller.close();
              return;
            }
          }

          if (done) break;
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

function normalizeHistory(value: unknown): ChatMessage[] {
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

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const apiKey = Deno.env.get("DASHSCOPE_API_KEY");
  if (!apiKey) {
    console.error("DASHSCOPE_API_KEY is not configured");
    return Response.json({ error: "AI 服务尚未完成配置。" }, { status: 500 });
  }

  let body: { message?: unknown; history?: unknown; replyLanguageMode?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求内容格式不正确。" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const replyLanguageMode = body.replyLanguageMode === "korean" || body.replyLanguageMode === "beginner" ? body.replyLanguageMode : "match";
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return Response.json({ error: `请输入 1 到 ${MAX_MESSAGE_LENGTH} 个字符的内容。` }, { status: 400 });
  }

  const history = normalizeHistory(body.history);
  const priorHistory = history.at(-1)?.role === "user" && history.at(-1)?.content === message
    ? history.slice(0, -1)
    : history;

  try {
    const upstream = await fetch(DASHSCOPE_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("QWEN_MODEL") ?? "qwen3.7-plus",
        messages: [
          { role: "system", content: `${SYSTEM_PROMPT}\n\n本次回复语言模式：${replyLanguageMode === "korean" ? "韩语沉浸。用户输入韩语时，必须只用韩语回答。" : replyLanguageMode === "beginner" ? "初级辅助。用户输入韩语时，以韩语回答，并在每个关键句后附简短中文释义；用户输入中文时只用中文回答。" : "智能跟随。中文输入用中文回答，韩语输入用韩语回答。"}` },
          ...priorHistory,
          { role: "user", content: message },
        ],
        temperature: 0.7,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!upstream.ok) {
      const payload = await upstream.json().catch(() => null) as Record<string, unknown> | null;
      console.error("Qwen request failed", upstream.status, payload);
      return Response.json({ error: "Qwen 服务暂时没有响应，请稍后再试。" }, { status: 502 });
    }

    if (!upstream.body) {
      return Response.json({ error: "Qwen 返回的内容无法显示，请重试。" }, { status: 502 });
    }

    return new Response(streamReply(upstream, getReplyLimit(message), getUserId(request)), {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    console.error("Qwen request error", error);
    return Response.json(
      { error: timedOut ? "Qwen 响应超时，请重新发送。" : "暂时无法连接 Qwen 服务。" },
      { status: 502 }
    );
  }
});
