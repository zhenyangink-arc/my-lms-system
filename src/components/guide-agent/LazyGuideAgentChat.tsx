"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Bot } from "lucide-react";

import {
  GuideAgentProvider,
  useGuideAgent,
} from "./GuideAgentProvider";

const GuideAgentChat = dynamic(
  () => import("./GuideAgentChat").then((module) => module.GuideAgentChat),
  { ssr: false, loading: () => <GuideAgentLoadingTrigger /> },
);

function GuideAgentLoadingTrigger() {
  return (
    <button
      type="button"
      disabled
      aria-label="正在打开学习助手"
      aria-busy="true"
      aria-controls="guide-agent-chat-panel"
      title="学习助手"
      className="inline-flex h-10 w-10 shrink-0 cursor-wait items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600"
    >
      <Bot size={18} aria-hidden="true" />
    </button>
  );
}

function LazyGuideAgentChatContent({
  studentId,
  dashboardBasePath,
}: {
  studentId: string;
  dashboardBasePath: string;
}) {
  const [activated, setActivated] = useState(false);
  const { setIsOpen } = useGuideAgent();

  if (activated) {
    return (
      <GuideAgentChat
        studentId={studentId}
        dashboardBasePath={dashboardBasePath}
        triggerVariant="portal"
      />
    );
  }

  return (
    <button
      type="button"
      aria-label="打开学习助手"
      aria-expanded={false}
      aria-controls="guide-agent-chat-panel"
      title="学习助手"
      onClick={() => {
        setIsOpen(true);
        setActivated(true);
      }}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
    >
      <Bot size={18} aria-hidden="true" />
    </button>
  );
}

export function LazyGuideAgentChat({
  studentId,
  dashboardBasePath,
}: {
  studentId: string;
  dashboardBasePath: string;
}) {
  return (
    <GuideAgentProvider>
      <LazyGuideAgentChatContent
        studentId={studentId}
        dashboardBasePath={dashboardBasePath}
      />
    </GuideAgentProvider>
  );
}
