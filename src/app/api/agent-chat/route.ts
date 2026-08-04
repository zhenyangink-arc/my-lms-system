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

const DEFAULT_DIFY_BASE_URL = "http://100.125.173.55/v1";
const DIFY_REQUEST_TIMEOUT_MS = 60_000;

function sanitizeDifyAnswer(value: string) {
  return value
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, "")
    .replace(/<think\b[^>]*>[\s\S]*$/gi, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\/\s*$/, "")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseSseEvents(rawStream: string) {
  return rawStream
    .replace(/\r\n/g, "\n")
    .split("\n\n")
    .flatMap((block) => {
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");

      if (!data || data === "[DONE]") return [];

      try {
        const event: unknown = JSON.parse(data);
        return isRecord(event) ? [event] : [];
      } catch {
        return [];
      }
    });
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

function parseDifyStream(rawStream: string) {
  const events = parseSseEvents(rawStream);
  const answerChunks: string[] = [];
  const actions: RawAgentAction[] = [];
  let conversationId = "";
  let fallbackAnswer = "";
  let replacementAnswer = "";

  for (const event of events) {
    const eventName = typeof event.event === "string" ? event.event : "";

    if (typeof event.conversation_id === "string") {
      conversationId = event.conversation_id;
    }

    if (
      (eventName === "message" || eventName === "agent_message") &&
      typeof event.answer === "string"
    ) {
      answerChunks.push(event.answer);
    }

    if (eventName === "message_replace" && typeof event.answer === "string") {
      replacementAnswer = event.answer;
    }

    if (eventName === "agent_thought") {
      collectAgentActions(event.observation, actions);
    }

    if (eventName === "node_finished" && isRecord(event.data)) {
      const outputs = isRecord(event.data.outputs)
        ? event.data.outputs
        : undefined;

      collectAgentActions(outputs?.json, actions);

      if (typeof outputs?.answer === "string") {
        fallbackAnswer = outputs.answer;
      } else if (typeof outputs?.text === "string") {
        fallbackAnswer = outputs.text;
      }
    }

    if (eventName === "workflow_finished" && isRecord(event.data)) {
      const outputs = isRecord(event.data.outputs)
        ? event.data.outputs
        : undefined;
      if (typeof outputs?.answer === "string") fallbackAnswer = outputs.answer;
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

  const deduplicatedActions = [
    ...new Map(
      actions.map((action) => [
        `${action.action}:${action.target}`,
        action,
      ]),
    ).values(),
  ];
  const streamedAnswer = answerChunks.join("");

  return {
    answer: sanitizeDifyAnswer(
      replacementAnswer || streamedAnswer || fallbackAnswer,
    ),
    conversationId,
    actions: deduplicatedActions,
    eventCount: events.length,
  };
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

    const rawStream = await difyResponse.text();
    const streamResult = parseDifyStream(rawStream);
    const resolvedActions = resolveAgentActions(streamResult.actions);

    if (!streamResult.answer || !streamResult.conversationId) {
      console.error("[agent-chat] Dify stream is missing required fields", {
        hasAnswer: Boolean(streamResult.answer),
        hasConversationId: Boolean(streamResult.conversationId),
        eventCount: streamResult.eventCount,
      });
      return NextResponse.json(
        { error: "Dify returned an invalid response" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      answer: streamResult.answer,
      conversation_id: streamResult.conversationId,
      actions: resolvedActions,
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
