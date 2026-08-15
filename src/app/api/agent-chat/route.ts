import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth";
import {
  resolveGuideHighlightTarget,
  resolveGuideNavigationTarget,
} from "@/lib/guide-agent-targets";

type AgentChatRequestBody = {
  message?: unknown;
  student_id?: unknown;
  conversation_id?: unknown;
};

type RawAgentAction = {
  action: "navigate" | "highlight";
  target: string;
  message?: string;
};

type ResolvedAgentAction =
  | {
      action: "navigate";
      target: string;
      message?: string;
    }
  | {
      action: "highlight";
      target: string;
      path?: string;
      message?: string;
    };

type DifyStreamState = {
  answerChunks: string[];
  actions: RawAgentAction[];
  conversationId: string;
  eventCount: number;
  fallbackAnswer: string;
  replacementAnswer: string;
};

const DEFAULT_DIFY_BASE_URL = "http://100.125.173.55/v1";
const DIFY_REQUEST_TIMEOUT_MS = 60_000;

function sanitizeDifyAnswer(value: string) {
  const sanitized = value
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "")
    .replace(/<think\b[^>]*>[\s\S]*$/gi, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\/\s*$/, "");

  // Do not briefly expose a split `<think>` opening tag while its remaining
  // characters are still in the next network chunk.
  const lowerCaseAnswer = sanitized.toLowerCase();
  const thinkTag = "<think";
  let safeAnswer = sanitized;

  for (let length = thinkTag.length - 1; length > 0; length -= 1) {
    if (lowerCaseAnswer.endsWith(thinkTag.slice(0, length))) {
      safeAnswer = sanitized.slice(0, -length);
      break;
    }
  }

  return safeAnswer.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseSseBlock(block: string) {
  const data = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");

  if (!data || data === "[DONE]") return null;

  try {
    const event: unknown = JSON.parse(data);
    return isRecord(event) ? event : null;
  } catch {
    return null;
  }
}

function collectAgentActions(
  value: unknown,
  actions: RawAgentAction[],
  depth = 0,
) {
  if (depth > 12 || value === null || value === undefined) return;

  if (typeof value === "string") {
    try {
      collectAgentActions(JSON.parse(value) as unknown, actions, depth + 1);
    } catch {
      for (const candidate of value.match(/\{[^{}]*\}/g) ?? []) {
        try {
          collectAgentActions(
            JSON.parse(candidate) as unknown,
            actions,
            depth + 1,
          );
        } catch {
          // Tool responses can contain ordinary text around their JSON payload.
        }
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectAgentActions(item, actions, depth + 1);
    return;
  }

  if (!isRecord(value)) return;

  const action = value.action;
  const target = typeof value.target === "string" ? value.target.trim() : "";

  if ((action === "navigate" || action === "highlight") && target) {
    actions.push({
      action,
      target,
      ...(typeof value.message === "string" && value.message.trim()
        ? { message: value.message.trim() }
        : {}),
    });
  }

  for (const child of Object.values(value)) {
    collectAgentActions(child, actions, depth + 1);
  }
}

function consumeDifyEvent(
  event: Record<string, unknown>,
  state: DifyStreamState,
) {
  state.eventCount += 1;
  const eventName = typeof event.event === "string" ? event.event : "";

  if (typeof event.conversation_id === "string") {
    state.conversationId = event.conversation_id;
  }

  if (
    (eventName === "message" || eventName === "agent_message") &&
    typeof event.answer === "string"
  ) {
    state.answerChunks.push(event.answer);
  }

  if (eventName === "message_replace" && typeof event.answer === "string") {
    state.replacementAnswer = event.answer;
  }

  if (eventName === "agent_thought") {
    collectAgentActions(event.observation, state.actions);
  }

  if (eventName === "node_finished" && isRecord(event.data)) {
    const outputs = isRecord(event.data.outputs)
      ? event.data.outputs
      : undefined;

    collectAgentActions(outputs?.json, state.actions);

    if (typeof outputs?.answer === "string") {
      state.fallbackAnswer = outputs.answer;
    } else if (typeof outputs?.text === "string") {
      state.fallbackAnswer = outputs.text;
    }
  }

  if (eventName === "workflow_finished" && isRecord(event.data)) {
    const outputs = isRecord(event.data.outputs)
      ? event.data.outputs
      : undefined;
    if (typeof outputs?.answer === "string") {
      state.fallbackAnswer = outputs.answer;
    }
  }

  if (eventName === "error") {
    const code = typeof event.code === "string" ? event.code : "unknown";
    const message =
      typeof event.message === "string"
        ? event.message
        : "Unknown streaming error";
    throw new Error(`Dify stream error (${code}): ${message}`);
  }
}

function getDifyAnswer(state: DifyStreamState) {
  return sanitizeDifyAnswer(
    state.replacementAnswer ||
      state.answerChunks.join("") ||
      state.fallbackAnswer,
  );
}

const streamEncoder = new TextEncoder();

function encodeStreamFrame(value: Record<string, unknown>) {
  return streamEncoder.encode(`${JSON.stringify(value)}\n`);
}

function resolveAgentActions(
  actions: RawAgentAction[],
): ResolvedAgentAction[] {
  const resolvedActions = actions.flatMap<ResolvedAgentAction>((action) => {
    if (action.action === "navigate") {
      const route = resolveGuideNavigationTarget(action.target);

      if (!route) {
        console.warn("[agent-chat] Ignoring unknown navigation target", {
          target: action.target,
        });
        return [];
      }

      return [
        {
          action: "navigate",
          target: route,
          ...(action.message ? { message: action.message } : {}),
        },
      ];
    }

    const highlightTarget = resolveGuideHighlightTarget(action.target);

    if (!highlightTarget) {
      console.warn("[agent-chat] Ignoring unknown highlight target", {
        target: action.target,
      });
      return [];
    }

    return [
      {
        action: "highlight",
        target: highlightTarget.elementId,
        ...(highlightTarget.path ? { path: highlightTarget.path } : {}),
        ...(action.message ? { message: action.message } : {}),
      },
    ];
  });

  return [
    ...new Map(
      resolvedActions.map((action) => [
        `${action.action}:${action.target}`,
        action,
      ]),
    ).values(),
  ];
}

export async function POST(request: Request) {
  let body: AgentChatRequestBody;

  try {
    const parsedBody: unknown = await request.json();

    if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 },
      );
    }

    body = parsedBody as AgentChatRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const studentId =
    typeof body.student_id === "string" ? body.student_id.trim() : "";

  if (!message || !studentId) {
    return NextResponse.json(
      { error: "message and student_id must be non-empty strings" },
      { status: 400 },
    );
  }

  const auth = await getAuthContext();

  if (auth.status === "unauthenticated") {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  if (auth.status !== "active" || auth.user.id !== studentId) {
    return NextResponse.json(
      { error: "student_id must match the authenticated user" },
      { status: 403 },
    );
  }

  const conversationId =
    typeof body.conversation_id === "string"
      ? body.conversation_id.trim()
      : "";
  const apiKey = process.env.DIFY_GUIDE_AGENT_API_KEY?.trim();

  if (!apiKey) {
    console.error(
      "[agent-chat] Missing required environment variable: DIFY_GUIDE_AGENT_API_KEY",
    );
    return NextResponse.json(
      { error: "Agent chat service is not configured" },
      { status: 500 },
    );
  }

  const baseUrl =
    process.env.DIFY_GUIDE_AGENT_BASE_URL?.trim() || DEFAULT_DIFY_BASE_URL;
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat-messages`;

  try {
    const difyResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {},
        query: `[学生ID: ${studentId}] ${message}`,
        response_mode: "streaming",
        conversation_id: conversationId,
        user: studentId,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(DIFY_REQUEST_TIMEOUT_MS),
    });

    if (difyResponse.status !== 200) {
      const errorDetails = await difyResponse.text();
      console.error("[agent-chat] Dify Chat API returned an error", {
        status: difyResponse.status,
        statusText: difyResponse.statusText,
        details: errorDetails,
      });
      return NextResponse.json(
        { error: "Failed to get a response from Dify" },
        { status: 500 },
      );
    }

    if (!difyResponse.body) {
      console.error("[agent-chat] Dify response is missing a body");
      return NextResponse.json(
        { error: "Dify returned an invalid response" },
        { status: 500 },
      );
    }

    const difyBody = difyResponse.body;
    const responseStream = new ReadableStream<Uint8Array>({
      start(controller) {
        void (async () => {
          const reader = difyBody.getReader();
          const decoder = new TextDecoder();
          const state: DifyStreamState = {
            answerChunks: [],
            actions: [],
            conversationId: "",
            eventCount: 0,
            fallbackAnswer: "",
            replacementAnswer: "",
          };
          let buffer = "";
          let lastSentAnswer = "";

          const processBlock = (block: string) => {
            const event = parseSseBlock(block);
            if (!event) return;

            consumeDifyEvent(event, state);
            const answer = getDifyAnswer(state);

            if (answer && answer !== lastSentAnswer) {
              lastSentAnswer = answer;
              controller.enqueue(
                encodeStreamFrame({ type: "answer", answer }),
              );
            }
          };

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              buffer = buffer.replace(/\r\n/g, "\n");

              let boundaryIndex = buffer.indexOf("\n\n");
              while (boundaryIndex >= 0) {
                processBlock(buffer.slice(0, boundaryIndex));
                buffer = buffer.slice(boundaryIndex + 2);
                boundaryIndex = buffer.indexOf("\n\n");
              }
            }

            buffer += decoder.decode();
            buffer = buffer.replace(/\r\n/g, "\n");
            if (buffer.trim()) processBlock(buffer);

            const answer = getDifyAnswer(state);
            const resolvedActions = resolveAgentActions(state.actions);

            if (!answer || !state.conversationId) {
              console.error("[agent-chat] Dify stream is missing required fields", {
                hasAnswer: Boolean(answer),
                hasConversationId: Boolean(state.conversationId),
                eventCount: state.eventCount,
              });
              controller.enqueue(
                encodeStreamFrame({
                  type: "error",
                  error: "Dify returned an invalid response",
                }),
              );
              return;
            }

            controller.enqueue(
              encodeStreamFrame({
                type: "done",
                answer,
                conversation_id: state.conversationId,
                actions: resolvedActions,
              }),
            );
          } catch (error) {
            console.error("[agent-chat] Failed while streaming Dify response", {
              endpoint,
              error,
            });
            controller.enqueue(
              encodeStreamFrame({
                type: "error",
                error: "Failed to stream a response from Dify",
              }),
            );
          } finally {
            reader.releaseLock();
            controller.close();
          }
        })();
      },
    });

    return new Response(responseStream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[agent-chat] Failed to call Dify Chat API", {
      endpoint,
      error,
    });
    return NextResponse.json(
      { error: "Failed to get a response from Dify" },
      { status: 500 },
    );
  }
}
