"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Bot } from "lucide-react";

import {
  GuideAgentProvider,
  useGuideAgent,
} from "./GuideAgentProvider";

const LightGuideAgentChat = dynamic(
  () => import("./GuideAgentChat").then((module) => module.GuideAgentChat),
  {
    ssr: false,
    loading: () => (
      <GuideAgentLoadingTrigger appearance="light" showLabel={false} />
    ),
  },
);

const DarkGuideAgentChat = dynamic(
  () => import("./GuideAgentChat").then((module) => module.GuideAgentChat),
  {
    ssr: false,
    loading: () => (
      <GuideAgentLoadingTrigger appearance="dark" showLabel />
    ),
  },
);

type PortalTriggerAppearance = "light" | "dark";

function portalTriggerClassName(
  appearance: PortalTriggerAppearance,
  showLabel: boolean,
) {
  const sizing = showLabel
    ? "h-11 gap-2 px-3 xl:px-3.5"
    : "h-10 w-10 justify-center";
  const colors = appearance === "dark"
    ? "border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:ring-emerald-300 focus-visible:ring-offset-slate-950"
    : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-indigo-500 focus-visible:ring-offset-white";

  return `inline-flex shrink-0 items-center rounded-xl border text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${sizing} ${colors}`;
}

function GuideAgentLoadingTrigger({
  appearance,
  showLabel,
}: {
  appearance: PortalTriggerAppearance;
  showLabel: boolean;
}) {
  return (
    <button
      type="button"
      disabled
      aria-label="正在打开学习助手"
      aria-busy="true"
      aria-controls="guide-agent-chat-panel"
      title="学习助手"
      className={`${portalTriggerClassName(appearance, showLabel)} cursor-wait opacity-70`}
    >
      <span className="relative">
        <Bot size={18} aria-hidden="true" />
        {appearance === "dark" ? (
          <span aria-hidden="true" className="absolute -right-1 -top-1 size-2 rounded-full bg-emerald-300 ring-2 ring-slate-950" />
        ) : null}
      </span>
      {showLabel ? <span className="hidden xl:inline">学习助手</span> : null}
    </button>
  );
}

function LazyGuideAgentChatContent({
  studentId,
  dashboardBasePath,
  appearance,
  showLabel,
}: {
  studentId: string;
  dashboardBasePath: string;
  appearance: PortalTriggerAppearance;
  showLabel: boolean;
}) {
  const [activated, setActivated] = useState(false);
  const { setIsOpen } = useGuideAgent();

  if (activated) {
    const GuideAgentChat = appearance === "dark"
      ? DarkGuideAgentChat
      : LightGuideAgentChat;

    return (
      <GuideAgentChat
        studentId={studentId}
        dashboardBasePath={dashboardBasePath}
        triggerVariant="portal"
        portalTriggerAppearance={appearance}
        portalTriggerShowLabel={showLabel}
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
      className={portalTriggerClassName(appearance, showLabel)}
    >
      <span className="relative">
        <Bot size={18} aria-hidden="true" />
        {appearance === "dark" ? (
          <span aria-hidden="true" className="absolute -right-1 -top-1 size-2 rounded-full bg-emerald-300 ring-2 ring-slate-950" />
        ) : null}
      </span>
      {showLabel ? <span className="hidden xl:inline">学习助手</span> : null}
    </button>
  );
}

export function LazyGuideAgentChat({
  studentId,
  dashboardBasePath,
  appearance = "light",
  showLabel = false,
}: {
  studentId: string;
  dashboardBasePath: string;
  appearance?: PortalTriggerAppearance;
  showLabel?: boolean;
}) {
  return (
    <GuideAgentProvider>
      <LazyGuideAgentChatContent
        studentId={studentId}
        dashboardBasePath={dashboardBasePath}
        appearance={appearance}
        showLabel={showLabel}
      />
    </GuideAgentProvider>
  );
}
