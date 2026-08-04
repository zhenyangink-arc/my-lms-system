"use client";

import { useRouter } from "next/navigation";
import {
  Bot,
  LoaderCircle,
  MessageCircleMore,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { scopeDashboardPath } from "@/lib/dashboard-path";
import {
  type GuideAgentMessageRole,
  useGuideAgent,
} from "./GuideAgentProvider";

type AgentChatResponse = {
  answer?: unknown;
  conversation_id?: unknown;
  actions?: unknown;
  error?: unknown;
};

type GuideAgentChatProps = {
  studentId: string;
  dashboardBasePath: string;
};

type GuideAgentAction = {
  action: "navigate" | "highlight";
  target: string;
  path?: string;
};

function createMessageId(role: GuideAgentMessageRole) {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isAgentChatResponse(value: unknown): value is AgentChatResponse {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isGuideAgentAction(value: unknown): value is GuideAgentAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const action = value as Record<string, unknown>;
  return (
    (action.action === "navigate" || action.action === "highlight") &&
    typeof action.target === "string" &&
    Boolean(action.target.trim()) &&
    (action.path === undefined || typeof action.path === "string")
  );
}

export function GuideAgentChat({
  studentId,
  dashboardBasePath,
}: GuideAgentChatProps) {
  const router = useRouter();
  const {
    isOpen,
    setIsOpen,
    messages,
    setMessages,
    conversationId,
    setConversationId,
  } = useGuideAgent();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const highlightTimersRef = useRef<number[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    messagesEndRef.current?.scrollIntoView({
      behavior: messages.length > 1 ? "smooth" : "auto",
      block: "end",
    });
  }, [isOpen, loading, messages]);

  useEffect(() => {
    if (isOpen && !loading) {
      inputRef.current?.focus();
    }
  }, [isOpen, loading]);

  useEffect(() => {
    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [setIsOpen]);

  useEffect(
    () => () => {
      for (const timer of highlightTimersRef.current) {
        window.clearTimeout(timer);
      }
    },
    [],
  );

  function highlightElement(elementId: string, attempt = 0) {
    const element = document.getElementById(elementId);

    if (!element) {
      if (attempt < 10) {
        const timer = window.setTimeout(
          () => highlightElement(elementId, attempt + 1),
          180,
        );
        highlightTimersRef.current.push(timer);
      } else {
        console.warn("[GuideAgentChat] Highlight target was not found", {
          elementId,
        });
      }
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.remove("guide-agent-highlight");
    void element.offsetWidth;
    element.classList.add("guide-agent-highlight");

    const timer = window.setTimeout(() => {
      element.classList.remove("guide-agent-highlight");
    }, 3_200);
    highlightTimersRef.current.push(timer);
  }

  function executeAgentAction(action: GuideAgentAction) {
    if (action.action === "navigate") {
      router.push(scopeDashboardPath(action.target, dashboardBasePath));
      return;
    }

    if (action.path) {
      router.push(scopeDashboardPath(action.path, dashboardBasePath), {
        scroll: false,
      });
    }

    const timer = window.setTimeout(
      () => highlightElement(action.target),
      action.path ? 180 : 0,
    );
    highlightTimersRef.current.push(timer);
  }

  async function sendMessage() {
    const message = input.trim();

    if (!message || loading) return;

    setMessages((current) => [
      ...current,
      {
        id: createMessageId("user"),
        role: "user",
        content: message,
      },
    ]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/agent-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          student_id: studentId,
          conversation_id: conversationId,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok || !isAgentChatResponse(payload)) {
        throw new Error("Guide Agent request failed");
      }

      const answer =
        typeof payload.answer === "string" ? payload.answer.trim() : "";
      const nextConversationId =
        typeof payload.conversation_id === "string"
          ? payload.conversation_id
          : "";
      const actions = Array.isArray(payload.actions)
        ? payload.actions.filter(isGuideAgentAction)
        : [];

      if (!answer) {
        throw new Error("Guide Agent returned an empty answer");
      }

      setConversationId(nextConversationId);
      setMessages((current) => [
        ...current,
        {
          id: createMessageId("assistant"),
          role: "assistant",
          content: answer,
        },
      ]);

      for (const action of actions) executeAgentAction(action);
    } catch (error) {
      console.error("[GuideAgentChat] Unable to send message", error);
      setMessages((current) => [
        ...current,
        {
          id: createMessageId("assistant"),
          role: "assistant",
          content: "抱歉，我暂时没能连接到学习助手。请稍后再试一次。",
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={isOpen ? "收起智能辅助" : "打开智能辅助"}
        aria-expanded={isOpen}
        aria-controls="guide-agent-chat-panel"
        onClick={() => setIsOpen((current) => !current)}
        className="app-glass-card inline-flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-black transition hover:-translate-y-0.5 sm:px-4"
        style={{
          color: isOpen ? "var(--app-accent-strong)" : "var(--app-text)",
          borderColor: isOpen ? "var(--app-accent)" : undefined,
        }}
      >
        <span className="relative">
          <Bot size={17} aria-hidden="true" />
          <span
            className="absolute -right-1 -top-1 h-2 w-2 rounded-full ring-2"
            style={{
              backgroundColor: "var(--app-success)",
              boxShadow: "0 0 0 2px var(--app-card-bg)",
            }}
          />
        </span>
        <span>智能辅助</span>
      </button>

      {isOpen && (
        <section
          id="guide-agent-chat-panel"
          role="dialog"
          aria-label="智能学习助手对话"
          className="fixed inset-x-3 bottom-36 z-[90] flex h-[min(620px,calc(100dvh-10rem))] flex-col overflow-hidden rounded-[20px] border shadow-[0_24px_70px_rgba(15,23,42,0.22)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 sm:inset-x-auto sm:right-6 sm:w-[390px] md:bottom-24"
          style={{
            color: "var(--app-text)",
            borderColor: "var(--app-border)",
            backgroundColor:
              "color-mix(in srgb, var(--app-card-bg) 96%, transparent)",
          }}
        >
          <header
            className="relative overflow-hidden border-b px-4 py-4"
            style={{
              borderColor: "var(--app-border-soft)",
              background:
                "linear-gradient(135deg, var(--app-accent-soft), var(--app-hero-end), var(--app-card-bg))",
            }}
          >
            <div
              className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-50 blur-2xl"
              style={{ backgroundColor: "var(--app-secondary-soft)" }}
            />
            <div className="relative flex items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
                style={{
                  background:
                    "linear-gradient(135deg, var(--app-accent-strong), var(--app-accent))",
                }}
              >
                <Bot size={22} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-black">
                  Guide Agent
                  <Sparkles
                    size={14}
                    style={{ color: "var(--app-warm)" }}
                    aria-hidden="true"
                  />
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold app-muted-text">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: "var(--app-success)" }}
                  />
                  在线 · 你的专属学习向导
                </span>
              </span>
              <button
                type="button"
                aria-label="关闭智能学习助手"
                onClick={() => setIsOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition hover:scale-105"
                style={{
                  color: "var(--app-muted)",
                  backgroundColor:
                    "color-mix(in srgb, var(--app-card-bg) 72%, transparent)",
                }}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
          </header>

          <div
            className="min-h-0 flex-1 overflow-y-auto px-4 py-5"
            aria-live="polite"
            aria-busy={loading}
          >
            <div className="space-y-4">
              {messages.map((message) => {
                const isUser = message.role === "user";

                return (
                  <div
                    key={message.id}
                    className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    {!isUser && (
                      <span
                        className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          color: "var(--app-accent-strong)",
                          backgroundColor: "var(--app-accent-soft)",
                        }}
                      >
                        <Bot size={14} aria-hidden="true" />
                      </span>
                    )}
                    <p
                      className={`max-w-[82%] whitespace-pre-wrap break-words px-3.5 py-2.5 text-sm leading-6 ${
                        isUser
                          ? "rounded-[18px] rounded-br-md text-white shadow-sm"
                          : "rounded-[18px] rounded-bl-md border"
                      }`}
                      style={
                        isUser
                          ? {
                              background:
                                "linear-gradient(135deg, var(--app-accent-strong), var(--app-accent))",
                            }
                          : message.isError
                            ? {
                                color: "var(--destructive)",
                                borderColor:
                                  "color-mix(in srgb, var(--destructive) 24%, transparent)",
                                backgroundColor:
                                  "color-mix(in srgb, var(--destructive) 7%, var(--app-card-bg))",
                              }
                            : {
                                color: "var(--app-text-soft)",
                                borderColor: "var(--app-border-soft)",
                                backgroundColor: "var(--app-soft-bg)",
                              }
                      }
                    >
                      {message.content}
                    </p>
                  </div>
                );
              })}

              {loading && (
                <div className="flex items-end gap-2">
                  <span
                    className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      color: "var(--app-accent-strong)",
                      backgroundColor: "var(--app-accent-soft)",
                    }}
                  >
                    <Bot size={14} aria-hidden="true" />
                  </span>
                  <div
                    className="flex items-center gap-2 rounded-[18px] rounded-bl-md border px-3.5 py-2.5 text-sm font-semibold app-muted-text"
                    style={{
                      borderColor: "var(--app-border-soft)",
                      backgroundColor: "var(--app-soft-bg)",
                    }}
                  >
                    <LoaderCircle
                      className="animate-spin"
                      size={15}
                      aria-hidden="true"
                    />
                    思考中…
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t p-3.5"
            style={{
              borderColor: "var(--app-border-soft)",
              backgroundColor:
                "color-mix(in srgb, var(--app-card-bg) 94%, transparent)",
            }}
          >
            <div
              className="flex items-end gap-2 rounded-2xl border p-2 transition focus-within:ring-2"
              style={{
                borderColor: "var(--app-border)",
                backgroundColor: "var(--app-input-bg)",
                boxShadow: loading
                  ? "none"
                  : "0 0 0 1px color-mix(in srgb, var(--app-accent) 8%, transparent)",
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleInputKeyDown}
                disabled={loading}
                rows={2}
                maxLength={2000}
                aria-label="输入要咨询的问题"
                placeholder={loading ? "助手正在思考…" : "问问课程、进度或学习建议…"}
                className="max-h-28 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-1 text-sm leading-5 outline-none placeholder:text-[color:var(--app-muted-light)] disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label={loading ? "正在发送" : "发送消息"}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-45"
                style={{
                  background:
                    "linear-gradient(135deg, var(--app-accent-strong), var(--app-accent))",
                }}
              >
                {loading ? (
                  <LoaderCircle
                    className="animate-spin"
                    size={17}
                    aria-hidden="true"
                  />
                ) : (
                  <Send size={17} aria-hidden="true" />
                )}
              </button>
            </div>
            <p className="mt-2 px-1 text-center text-[10px] font-semibold app-muted-text">
              Enter 发送 · Shift + Enter 换行
            </p>
          </form>
        </section>
      )}

      <button
        type="button"
        aria-label={isOpen ? "收起学习助手" : "打开学习助手"}
        aria-expanded={isOpen}
        aria-controls="guide-agent-chat-panel"
        onClick={() => setIsOpen((current) => !current)}
        className="fixed bottom-20 right-4 z-[91] flex h-14 items-center justify-center gap-2 rounded-full px-4 text-sm font-black text-white shadow-[0_12px_34px_rgba(15,23,42,0.24)] transition hover:-translate-y-1 md:bottom-6 md:right-6"
        style={{
          background: isOpen
            ? "linear-gradient(135deg, var(--app-secondary), var(--app-warm))"
            : "linear-gradient(135deg, var(--app-accent-strong), var(--app-accent))",
        }}
      >
        {isOpen ? (
          <X size={20} aria-hidden="true" />
        ) : (
          <MessageCircleMore size={20} aria-hidden="true" />
        )}
        <span className="hidden sm:inline">
          {isOpen ? "收起助手" : "问问学习助手"}
        </span>
      </button>
    </>
  );
}
