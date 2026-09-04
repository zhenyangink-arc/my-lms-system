type Provider = "qwen" | "deepseek";

type GuideAgentRequest = {
  agentCode?: unknown;
  message?: unknown;
  currentPath?: unknown;
  studentContext?: unknown;
  history?: unknown;
};

type ChatMessage = { role: "user" | "assistant"; content: string };
type AgentProfile = {
  id: string;
  agent_code: string;
  display_name: Record<string, unknown>;
  system_prompt: string;
  provider: Provider;
  model: string;
  reply_policy: Record<string, unknown>;
};

const MAX_HISTORY_ITEMS = 10;

function text(value: unknown, maxLength = 1000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      role: item.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: text(item.content, 1000),
    }))
    .filter((item) => item.content)
    .slice(-MAX_HISTORY_ITEMS);
}

function providerConfig(profile: AgentProfile) {
  if (profile.provider === "deepseek") {
    const apiKey = Deno.env.get("DEEPSEEK_API_KEY") ?? "";
    if (!apiKey) return null;
    return {
      provider: profile.provider,
      model: profile.model,
      apiKey,
      endpoint: `${(Deno.env.get("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com").replace(/\/$/, "")}/chat/completions`,
    };
  }

  const apiKey = Deno.env.get("DASHSCOPE_API_KEY") ?? "";
  if (!apiKey) return null;
  return {
    provider: profile.provider,
    model: profile.model,
    apiKey,
    endpoint: Deno.env.get("QWEN_AGENT_URL") ?? "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
  };
}

async function loadAgentProfile(agentCode: string): Promise<AgentProfile | null> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  // 用 PostgREST 的关联查询一次性拿到 profile + secrets，避免每次提问都串行发两次请求。
  const response = await fetch(
    `${url}/rest/v1/learning_agent_profile_secrets` +
      `?select=agent_profile_id,system_prompt,provider,model,reply_policy,learning_agent_profiles!inner(id,agent_code,display_name)` +
      `&learning_agent_profiles.agent_code=eq.${encodeURIComponent(agentCode)}` +
      `&learning_agent_profiles.status=eq.published&limit=1`,
    { headers },
  );
  if (!response.ok) return null;
  const rows = await response.json() as Array<
    Pick<AgentProfile, "system_prompt" | "provider" | "model" | "reply_policy"> & {
      agent_profile_id: string;
      learning_agent_profiles: Pick<AgentProfile, "id" | "agent_code" | "display_name">;
    }
  >;
  const row = rows[0];
  if (!row) return null;
  return { ...row.learning_agent_profiles, ...row };
}

function getUserId(request: Request) {
  try {
    const payload = (request.headers.get("authorization") ?? "").split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).sub as string | undefined;
  } catch {
    return undefined;
  }
}

function recordUsage(
  userId: string | undefined,
  provider: Provider,
  model: string,
  agentCode: string,
  usage: Record<string, unknown>,
) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  void fetch(`${url}/rest/v1/ai_token_usage`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      user_id: userId ?? null,
      provider,
      model,
      feature_code: "guide_agent",
      agent_code: agentCode,
      input_tokens: Number(usage.prompt_tokens ?? 0),
      output_tokens: Number(usage.completion_tokens ?? 0),
      total_tokens: Number(usage.total_tokens ?? 0),
    }),
  });
}

function streamAnswer(
  upstream: Response,
  config: { provider: Provider; model: string },
  userId: string | undefined,
  agentCode: string,
  maxOutputCharacters: number,
) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";
  let emitted = 0;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body?.getReader();
      if (!reader) {
        controller.error(new Error("导航助手没有返回可读取内容。"));
        return;
      }
      try {
        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const event of events) {
            const data = event.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            const payload = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: unknown } }>;
              usage?: Record<string, unknown>;
            };
            if (payload.usage) {
              recordUsage(userId, config.provider, config.model, agentCode, payload.usage);
            }
            const delta = payload.choices?.[0]?.delta?.content;
            if (typeof delta !== "string") continue;
            const remaining = maxOutputCharacters - emitted;
            if (remaining <= 0) continue;
            const chunk = Array.from(delta).slice(0, remaining).join("");
            emitted += Array.from(chunk).length;
            if (chunk) controller.enqueue(encoder.encode(chunk));
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

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: GuideAgentRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求内容格式不正确。" }, { status: 400 });
  }

  const agentCode = text(body.agentCode, 120);
  const message = text(body.message, 2000);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(agentCode) || !message) {
    return Response.json({ error: "导航助手请求不完整。" }, { status: 400 });
  }
  const profile = await loadAgentProfile(agentCode);
  if (!profile) {
    return Response.json({ error: "导航助手尚未发布。" }, { status: 404 });
  }
  const config = providerConfig(profile);
  if (!config) {
    return Response.json({ error: "导航助手的模型服务尚未配置。" }, { status: 503 });
  }

  const maxOutputCharacters = Math.max(
    120,
    Math.min(1000, Number(profile.reply_policy.maxOutputCharacters) || 480),
  );
  const currentPath = text(body.currentPath, 500) || "/dashboard";
  const studentContext = text(body.studentContext, 8000) || "暂无可用学习记录";
  const systemPrompt = `${profile.system_prompt}\n回答不超过 ${maxOutputCharacters} 个字符。不要使用 Markdown 标题、表格或装饰性英文标签。系统会在模型之外安全执行页面跳转，你只需用自然语言说明下一步。`;
  const userPrompt = `当前页面：${currentPath}\n真实学习情况：${studentContext}\n学生问题：${message}\n请直接回答学生。`;

  try {
    const upstream = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          ...normalizeHistory(body.history),
          { role: "user", content: userPrompt },
        ],
        temperature: 0.25,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!upstream.ok || !upstream.body) {
      console.error("Guide agent upstream failed", profile.agent_code, config.provider, upstream.status);
      return Response.json({ error: "导航助手暂时没有响应。" }, { status: 502 });
    }

    return new Response(
      streamAnswer(upstream, config, getUserId(request), profile.agent_code, maxOutputCharacters),
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Guide-Agent-Code": profile.agent_code,
          "X-Guide-Agent-Provider": config.provider,
          "X-Guide-Agent-Model": config.model,
        },
      },
    );
  } catch (error) {
    console.error("Guide agent request failed", profile.agent_code, error);
    return Response.json({ error: "暂时无法连接导航助手。" }, { status: 502 });
  }
});
