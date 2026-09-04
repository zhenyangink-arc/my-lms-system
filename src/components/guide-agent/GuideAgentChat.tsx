"use client";

import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
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
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { scopeDashboardPath } from "@/lib/dashboard-path";
import {
  type GuideAgentMessageRole,
  useGuideAgent,
} from "./GuideAgentProvider";

type GuideAgentChatProps = {
  studentId: string;
  dashboardBasePath: string;
  triggerVariant?: "dashboard" | "portal";
  portalTriggerAppearance?: "light" | "dark";
  portalTriggerShowLabel?: boolean;
};

type GuideAgentAction = {
  action: "navigate" | "highlight";
  target: string;
  path?: string;
};

type AgentChatStreamFrame =
  | { type: "answer"; answer: string }
  | {
      type: "done";
      answer: string;
      conversation_id: string;
      actions: GuideAgentAction[];
    }
  | { type: "error"; error: string };

type FloatingPosition = {
  x: number;
  y: number;
};

type FloatingDragState = FloatingPosition & {
  pointerId: number;
  pointerX: number;
  pointerY: number;
  width: number;
  height: number;
  moved: boolean;
};

const GUIDE_AGENT_POSITION_KEY = "guide-agent-floating-position";
const FLOATING_EDGE_GAP = 12;

function subscribeToClientReady() {
  return () => undefined;
}

function createMessageId(role: GuideAgentMessageRole) {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function parseAgentChatStreamFrame(value: string): AgentChatStreamFrame | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const frame = parsed as Record<string, unknown>;

  if (frame.type === "answer" && typeof frame.answer === "string") {
    return { type: "answer", answer: frame.answer };
  }

  if (
    frame.type === "done" &&
    typeof frame.answer === "string" &&
    typeof frame.conversation_id === "string"
  ) {
    return {
      type: "done",
      answer: frame.answer,
      conversation_id: frame.conversation_id,
      actions: Array.isArray(frame.actions)
        ? frame.actions.filter(isGuideAgentAction)
        : [],
    };
  }

  if (frame.type === "error" && typeof frame.error === "string") {
    return { type: "error", error: frame.error };
  }

  return null;
}

export function GuideAgentChat({
  studentId,
  dashboardBasePath,
  triggerVariant = "dashboard",
  portalTriggerAppearance = "light",
  portalTriggerShowLabel = false,
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
  const [receivingResponse, setReceivingResponse] = useState(false);
  const portalReady = useSyncExternalStore(
    subscribeToClientReady,
    () => true,
    () => false,
  );
  const [floatingPosition, setFloatingPosition] = useState<FloatingPosition | null>(null);
  const [isDraggingTrigger, setIsDraggingTrigger] = useState(false);
  const [isFloatingVisible, setIsFloatingVisible] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const floatingTriggerRef = useRef<HTMLButtonElement>(null);
  const floatingDragRef = useRef<FloatingDragState | null>(null);
  const suppressFloatingClickRef = useRef(false);
  const highlightTimersRef = useRef<number[]>([]);

  function clampFloatingPosition(
    position: FloatingPosition,
    width: number,
    height: number,
  ): FloatingPosition {
    return {
      x: Math.min(
        Math.max(FLOATING_EDGE_GAP, position.x),
        Math.max(FLOATING_EDGE_GAP, window.innerWidth - width - FLOATING_EDGE_GAP),
      ),
      y: Math.min(
        Math.max(FLOATING_EDGE_GAP, position.y),
        Math.max(FLOATING_EDGE_GAP, window.innerHeight - height - FLOATING_EDGE_GAP),
      ),
    };
  }

  function persistFloatingPosition(position: FloatingPosition) {
    window.localStorage.setItem(GUIDE_AGENT_POSITION_KEY, JSON.stringify(position));
  }

  useEffect(() => {
    if (!portalReady) return;

    const storedPosition = window.localStorage.getItem(GUIDE_AGENT_POSITION_KEY);

    if (!storedPosition) return;

    try {
      const parsed = JSON.parse(storedPosition) as Partial<FloatingPosition>;
      if (typeof parsed.x === "number" && typeof parsed.y === "number") {
        const frameId = window.requestAnimationFrame(() => {
          const rect = floatingTriggerRef.current?.getBoundingClientRect();
          if (!rect) return;
          setFloatingPosition(
            clampFloatingPosition(
              { x: parsed.x as number, y: parsed.y as number },
              rect.width,
              rect.height,
            ),
          );
        });
        return () => window.cancelAnimationFrame(frameId);
      }
    } catch {
      window.localStorage.removeItem(GUIDE_AGENT_POSITION_KEY);
    }
  }, [portalReady]);

  useEffect(() => {
    function keepTriggerInsideViewport() {
      const rect = floatingTriggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      setFloatingPosition((current) =>
        current
          ? clampFloatingPosition(current, rect.width, rect.height)
          : current,
      );
    }

    window.addEventListener("resize", keepTriggerInsideViewport);
    return () => window.removeEventListener("resize", keepTriggerInsideViewport);
  }, []);

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
    setReceivingResponse(false);

    const assistantMessageId = createMessageId("assistant");
    let streamedAnswer = "";
    let assistantMessageAdded = false;

    const renderStreamedAnswer = (answer: string) => {
      if (!answer) return;

      streamedAnswer = answer;
      setReceivingResponse(true);
      if (!assistantMessageAdded) {
        assistantMessageAdded = true;
        setMessages((current) => [
          ...current,
          {
            id: assistantMessageId,
            role: "assistant",
            content: answer,
          },
        ]);
        return;
      }

      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessageId
            ? { ...item, content: answer }
            : item,
        ),
      );
    };

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

      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const errorMessage =
          payload && typeof payload === "object" && !Array.isArray(payload)
            ? (payload as Record<string, unknown>).error
            : undefined;
        throw new Error(
          typeof errorMessage === "string"
            ? errorMessage
            : "导航助手请求失败",
        );
      }

      if (!response.body) {
        throw new Error("导航助手没有返回内容");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamCompleted = false;

      const processFrame = (line: string) => {
        if (!line.trim()) return;

        const frame = parseAgentChatStreamFrame(line);
        if (!frame) {
          throw new Error("导航助手返回的数据格式不正确");
        }

        if (frame.type === "error") {
          throw new Error(frame.error);
        }

        renderStreamedAnswer(frame.answer);

        if (frame.type === "done") {
          if (!frame.answer.trim() || !frame.conversation_id.trim()) {
            throw new Error("导航助手回复不完整");
          }

          setConversationId(frame.conversation_id);
          for (const action of frame.actions) executeAgentAction(action);
          streamCompleted = true;
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) processFrame(line);
        }

        buffer += decoder.decode();
        if (buffer.trim()) processFrame(buffer);
      } catch (error) {
        await reader.cancel().catch(() => undefined);
        throw error;
      } finally {
        reader.releaseLock();
      }

      if (!streamCompleted) {
        throw new Error("导航助手回复意外中断");
      }
    } catch (error) {
      console.error("[GuideAgentChat] Unable to send message", error);
      setMessages((current) => {
        if (assistantMessageAdded) {
          return current.map((item) =>
            item.id === assistantMessageId
              ? {
                  ...item,
                  content: streamedAnswer
                    ? `${streamedAnswer}\n\n（回答中断，请再试一次。）`
                    : "抱歉，我暂时没能连接到学习助手。请稍后再试一次。",
                  isError: true,
                }
              : item,
          );
        }

        return [
          ...current,
          {
            id: assistantMessageId,
            role: "assistant",
            content: "抱歉，我暂时没能连接到学习助手。请稍后再试一次。",
            isError: true,
          },
        ];
      });
    } finally {
      setReceivingResponse(false);
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

  function handleFloatingPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    floatingDragRef.current = {
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleFloatingPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = floatingDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.pointerX;
    const deltaY = event.clientY - drag.pointerY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 5) return;

    drag.moved = true;
    suppressFloatingClickRef.current = true;
    setIsDraggingTrigger(true);
    setFloatingPosition(
      clampFloatingPosition(
        { x: drag.x + deltaX, y: drag.y + deltaY },
        drag.width,
        drag.height,
      ),
    );
  }

  function finishFloatingDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = floatingDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (drag.moved) {
      const finalPosition = clampFloatingPosition(
        {
          x: drag.x + event.clientX - drag.pointerX,
          y: drag.y + event.clientY - drag.pointerY,
        },
        drag.width,
        drag.height,
      );
      setFloatingPosition(finalPosition);
      persistFloatingPosition(finalPosition);
      window.setTimeout(() => {
        suppressFloatingClickRef.current = false;
      }, 0);
    }

    floatingDragRef.current = null;
    setIsDraggingTrigger(false);
  }

  function moveFloatingTriggerWithKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (!event.altKey || !event.key.startsWith("Arrow")) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const offset = event.shiftKey ? 32 : 12;
    const next = clampFloatingPosition(
      {
        x: rect.left + (event.key === "ArrowRight" ? offset : event.key === "ArrowLeft" ? -offset : 0),
        y: rect.top + (event.key === "ArrowDown" ? offset : event.key === "ArrowUp" ? -offset : 0),
      },
      rect.width,
      rect.height,
    );

    event.preventDefault();
    setFloatingPosition(next);
    persistFloatingPosition(next);
  }

  return (
    <>
      {triggerVariant === "portal" ? (
        <button
          type="button"
          aria-label={isOpen ? "收起学习助手" : "打开学习助手"}
          title="学习助手"
          aria-expanded={isOpen}
          aria-controls="guide-agent-chat-panel"
          onClick={() => {
            setIsFloatingVisible(true);
            setIsOpen((current) => !current);
          }}
          className={`inline-flex shrink-0 items-center rounded-xl border text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${portalTriggerShowLabel ? "h-11 gap-2 px-3 xl:px-3.5" : "h-10 w-10 justify-center"} ${portalTriggerAppearance === "dark" ? "border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:ring-emerald-300 focus-visible:ring-offset-slate-950" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-indigo-500 focus-visible:ring-offset-white"}`}
        >
          <span className="relative">
            <Bot size={18} aria-hidden="true" />
            {portalTriggerAppearance === "dark" ? (
              <span aria-hidden="true" className="absolute -right-1 -top-1 size-2 rounded-full bg-emerald-300 ring-2 ring-slate-950" />
            ) : null}
          </span>
          {portalTriggerShowLabel ? (
            <span className="hidden xl:inline">学习助手</span>
          ) : null}
        </button>
      ) : (
        <button
          type="button"
          aria-label={isOpen ? "收起 UPLY 导航助手" : "打开 UPLY 导航助手"}
          aria-expanded={isOpen}
          aria-controls="guide-agent-chat-panel"
          onClick={() => {
            setIsFloatingVisible(true);
            setIsOpen((current) => !current);
          }}
          className="app-glass-card inline-flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2.5 text-base font-black tracking-tight transition hover:-translate-y-0.5 sm:px-4 sm:text-lg"
          style={{
            color: isOpen ? "var(--primary-hover)" : "var(--foreground)",
            borderColor: isOpen ? "var(--primary)" : undefined,
          }}
        >
          <span className="relative">
            <Bot size={18} aria-hidden="true" />
            <span
              className="absolute -right-1 -top-1 h-2 w-2 rounded-full ring-2"
              style={{
                backgroundColor: "var(--status-success)",
                boxShadow: "0 0 0 2px var(--card)",
              }}
            />
          </span>
          <span>导航助手</span>
        </button>
      )}

      {isOpen && portalReady && createPortal(
        <section
          id="guide-agent-chat-panel"
          role="dialog"
          aria-label="UPLY 导航助手对话"
          className={`${triggerVariant === "dashboard" ? "student-system-floating-layer " : ""}fixed inset-x-3 bottom-36 z-[90] flex h-[min(620px,calc(100dvh-10rem))] flex-col overflow-hidden rounded-[20px] border shadow-[0_24px_70px_rgba(15,23,42,0.22)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 sm:inset-x-auto sm:right-6 sm:w-[390px] md:bottom-24`}
          style={{
            color: "var(--foreground)",
            borderColor: "var(--border)",
            backgroundColor:
              "color-mix(in srgb, var(--card) 96%, transparent)",
          }}
        >
          <header
            className="relative overflow-hidden border-b px-4 py-4"
            style={{
              borderColor: "var(--border-subtle)",
              background:
                "linear-gradient(135deg, var(--accent), var(--accent), var(--card))",
            }}
          >
            <div
              className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full opacity-50 blur-2xl"
              style={{ backgroundColor: "var(--support-surface)" }}
            />
            <div className="relative flex items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
                style={{
                  background:
                    "linear-gradient(135deg, var(--primary-hover), var(--primary))",
                }}
              >
                <Bot size={22} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-black">
                  UPLY 导航助手
                  <Sparkles
                    size={14}
                    style={{ color: "var(--status-warning)" }}
                    aria-hidden="true"
                  />
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold app-muted-text">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: "var(--status-success)" }}
                  />
                  在线 · 你的专属学习向导
                </span>
              </span>
              <button
                type="button"
                aria-label="关闭 UPLY 导航助手"
                onClick={() => setIsOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition hover:scale-105"
                style={{
                  color: "var(--foreground-muted)",
                  backgroundColor:
                    "color-mix(in srgb, var(--card) 72%, transparent)",
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
                          color: "var(--primary-hover)",
                          backgroundColor: "var(--accent)",
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
                                "linear-gradient(135deg, var(--primary-hover), var(--primary))",
                            }
                          : message.isError
                            ? {
                                color: "var(--destructive)",
                                borderColor:
                                  "color-mix(in srgb, var(--destructive) 24%, transparent)",
                                backgroundColor:
                                  "color-mix(in srgb, var(--destructive) 7%, var(--card))",
                              }
                            : {
                                color: "var(--foreground-secondary)",
                                borderColor: "var(--border-subtle)",
                                backgroundColor: "var(--surface-soft)",
                              }
                      }
                    >
                      {message.content}
                    </p>
                  </div>
                );
              })}

              {loading && !receivingResponse && (
                <div className="flex items-end gap-2">
                  <span
                    className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      color: "var(--primary-hover)",
                      backgroundColor: "var(--accent)",
                    }}
                  >
                    <Bot size={14} aria-hidden="true" />
                  </span>
                  <div
                    className="flex items-center gap-2 rounded-[18px] rounded-bl-md border px-3.5 py-2.5 text-sm font-semibold app-muted-text"
                    style={{
                      borderColor: "var(--border-subtle)",
                      backgroundColor: "var(--surface-soft)",
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
              borderColor: "var(--border-subtle)",
              backgroundColor:
                "color-mix(in srgb, var(--card) 94%, transparent)",
            }}
          >
            <div
              className="flex items-end gap-2 rounded-2xl border p-2 transition focus-within:ring-2"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--card)",
                boxShadow: loading
                  ? "none"
                  : "0 0 0 1px color-mix(in srgb, var(--primary) 8%, transparent)",
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
                className="max-h-28 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-1.5 py-1 text-sm leading-5 outline-none placeholder:text-[color:var(--foreground-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label={loading ? "正在发送" : "发送消息"}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-45"
                style={{
                  background:
                    "linear-gradient(135deg, var(--primary-hover), var(--primary))",
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
        </section>,
        document.body,
      )}

      {triggerVariant === "dashboard" && portalReady && isFloatingVisible && createPortal(
        <>
          <span id="guide-agent-drag-help" className="sr-only">
            可拖动调整位置；按 Alt 加方向键也可以移动。
          </span>
          <div
            className="student-system-floating-layer fixed bottom-20 right-4 z-[91] md:bottom-6 md:right-6"
            style={{
            ...(floatingPosition
              ? {
                  left: `${floatingPosition.x}px`,
                  top: `${floatingPosition.y}px`,
                  right: "auto",
                  bottom: "auto",
                }
                : null),
            }}
          >
            <button
              ref={floatingTriggerRef}
              type="button"
              aria-label={isOpen ? "收起学习助手" : "打开学习助手"}
              aria-describedby="guide-agent-drag-help"
              aria-expanded={isOpen}
              aria-controls="guide-agent-chat-panel"
              title="拖动可调整位置；Alt + 方向键可微调"
              onClick={() => {
                if (suppressFloatingClickRef.current) return;
                setIsOpen((current) => !current);
              }}
              onKeyDown={moveFloatingTriggerWithKeyboard}
              onPointerDown={handleFloatingPointerDown}
              onPointerMove={handleFloatingPointerMove}
              onPointerUp={finishFloatingDrag}
              onPointerCancel={finishFloatingDrag}
              className={`flex h-14 touch-none select-none items-center justify-center gap-2 rounded-full px-4 text-sm font-black text-white shadow-[0_12px_34px_rgba(15,23,42,0.24)] transition ${
                isDraggingTrigger ? "cursor-grabbing scale-[1.03]" : "cursor-grab hover:-translate-y-1"
              }`}
              style={{
                background: isOpen
                  ? "linear-gradient(135deg, var(--support), var(--status-warning))"
                  : "linear-gradient(135deg, var(--primary-hover), var(--primary))",
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
            <button
              type="button"
              aria-label="关闭并隐藏学习助手"
              title="关闭学习助手"
              onClick={() => {
                setIsOpen(false);
                setIsFloatingVisible(false);
              }}
              className="absolute -right-1.5 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/80 bg-white text-slate-500 shadow-md transition hover:scale-105 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
