type Provider = "qwen" | "deepseek";

type LearningAgentRequest = {
  agentCode?: unknown;
  locale?: unknown;
  supportMode?: unknown;
  intent?: unknown;
  chapterTitle?: unknown;
  moduleTitle?: unknown;
  moduleGoal?: unknown;
  script?: unknown;
  publishedContext?: unknown;
  studentMessage?: unknown;
  completionPercent?: unknown;
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

const MAX_STUDENT_MESSAGE_CHARACTERS = 500;
const MAX_HISTORY_ITEMS = 8;

function text(value: unknown, maxLength = 1000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      role: item.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: text(item.content, 500),
    }))
    .filter((item) => item.content)
    .slice(-MAX_HISTORY_ITEMS);
}

function providerConfig(profile: AgentProfile): { provider: Provider; apiKey: string; endpoint: string; model: string } | null {
  if (profile.provider === "deepseek") {
    const apiKey = Deno.env.get("DEEPSEEK_API_KEY") ?? "";
    if (!apiKey) return null;
    return {
      provider: profile.provider,
      apiKey,
      endpoint: `${(Deno.env.get("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com").replace(/\/$/, "")}/chat/completions`,
      model: profile.model,
    };
  }

  const apiKey = Deno.env.get("DASHSCOPE_API_KEY") ?? "";
  if (!apiKey) return null;
  return {
    provider: profile.provider,
    apiKey,
    endpoint: Deno.env.get("QWEN_AGENT_URL") ?? "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    model: profile.model,
  };
}

async function loadAgentProfile(agentCode: string): Promise<AgentProfile | null> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  const response = await fetch(
    `${url}/rest/v1/learning_agent_profiles?agent_code=eq.${encodeURIComponent(agentCode)}&status=eq.published&select=id,agent_code,display_name&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!response.ok) return null;
  const rows = await response.json() as Array<Pick<AgentProfile, "id" | "agent_code" | "display_name">>;
  const publicProfile = rows[0];
  if (!publicProfile) return null;
  const secretResponse = await fetch(
    `${url}/rest/v1/learning_agent_profile_secrets?agent_profile_id=eq.${encodeURIComponent(publicProfile.id)}&select=system_prompt,provider,model,reply_policy&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!secretResponse.ok) return null;
  const secrets = await secretResponse.json() as Array<Pick<AgentProfile, "system_prompt" | "provider" | "model" | "reply_policy">>;
  return secrets[0] ? { ...publicProfile, ...secrets[0] } : null;
}

function localizedName(profile: AgentProfile, locale: string) {
  return String(profile.display_name[locale] ?? profile.display_name["zh-CN"] ?? profile.agent_code);
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
      feature_code: "learning_agent",
      agent_code: agentCode,
      input_tokens: Number(usage.prompt_tokens ?? 0),
      output_tokens: Number(usage.completion_tokens ?? 0),
      total_tokens: Number(usage.total_tokens ?? 0),
    }),
  });
}

function streamText(
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
        controller.error(new Error("教学模型没有返回可读取内容。"));
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
            if (payload.usage) recordUsage(userId, config.provider, config.model, agentCode, payload.usage);
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

  let body: LearningAgentRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求内容格式不正确。" }, { status: 400 });
  }

  const agentCode = text(body.agentCode, 120);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(agentCode)) {
    return Response.json({ error: "课程 Agent 标识不正确。" }, { status: 400 });
  }
  const profile = await loadAgentProfile(agentCode);
  if (!profile) {
    return Response.json({ error: "课程绑定的学习 Agent 尚未发布。" }, { status: 404 });
  }
  const config = providerConfig(profile);
  if (!config) {
    return Response.json({ error: `${localizedName(profile, "zh-CN")}的模型服务尚未配置。` }, { status: 503 });
  }

  const locale = body.locale === "ko-KR" ? "ko-KR" : "zh-CN";
  const supportMode = ["chinese", "bilingual", "immersion"].includes(String(body.supportMode))
    ? String(body.supportMode)
    : "bilingual";
  const studentMessage = text(body.studentMessage, MAX_STUDENT_MESSAGE_CHARACTERS);
  const script = text(body.script, 1200);
  if (!script) return Response.json({ error: "当前教学脚本未发布。" }, { status: 422 });

  const languageModes = profile.reply_policy.languageModes && typeof profile.reply_policy.languageModes === "object"
    ? profile.reply_policy.languageModes as Record<string, unknown>
    : {};
  const replyLanguage = text(languageModes[supportMode], 500) || "使用当前界面的自然语言简洁讲解";
  const maxOutputCharacters = Math.max(80, Math.min(1000, Number(profile.reply_policy.maxOutputCharacters) || 320));
  const systemPrompt = `${profile.system_prompt}\n${replyLanguage}。回复不超过 ${maxOutputCharacters} 个字符。只能使用系统提供的已发布内容，不得自行修改学习状态。`;
  const userPrompt = `章节：${text(body.chapterTitle, 120)}\n模块：${text(body.moduleTitle, 120)}\n模块目标：${text(body.moduleGoal, 300)}\n真实完成度：${Math.max(0, Math.min(100, Number(body.completionPercent) || 0))}%\n当前意图：${text(body.intent, 20)}\n已发布教学脚本：${script}\n已发布教材内容：${text(body.publishedContext, 6000)}\n学生补充问题：${studentMessage || "无"}\n请直接给出本轮老师讲解。`;

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
        temperature: 0.35,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!upstream.ok || !upstream.body) {
      console.error("Learning agent upstream failed", profile.agent_code, config.provider, upstream.status);
      return Response.json({ error: `${localizedName(profile, locale)}暂时没有响应。` }, { status: 502 });
    }

    return new Response(streamText(upstream, config, getUserId(request), profile.agent_code, maxOutputCharacters), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Learning-Agent-Code": profile.agent_code,
        "X-Learning-Agent-Provider": config.provider,
        "X-Learning-Agent-Model": config.model,
      },
    });
  } catch (error) {
    console.error("Learning agent request failed", profile.agent_code, error);
    return Response.json({ error: `暂时无法连接${localizedName(profile, locale)}。` }, { status: 502 });
  }
});
