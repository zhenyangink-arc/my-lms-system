"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MessageCircleMore,
  Mic,
  RotateCcw,
  Sparkles,
  Timer,
} from "lucide-react";

import {
  ConversationAiExperience,
  type FormalPracticeConfig,
  type FormalPracticeSummary,
} from "./ConversationAiExperience";

const scenarios = ["自由交流", "自我介绍", "校园生活", "大学面试"] as const;
const difficulties = [
  ["beginner", "初级"],
  ["intermediate", "中级"],
  ["advanced", "高级"],
] as const;
const replyModes = [
  ["beginner", "初级辅助"],
  ["match", "智能跟随"],
  ["korean", "韩语沉浸"],
] as const;
const durations = [5, 10, 15] as const;

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes} 分 ${String(remainingSeconds).padStart(2, "0")} 秒`;
}

export function FormalConversationPractice() {
  const [phase, setPhase] = useState<"setup" | "session" | "summary">("setup");
  const [scenario, setScenario] = useState<(typeof scenarios)[number]>("自由交流");
  const [difficulty, setDifficulty] = useState<FormalPracticeConfig["difficulty"]>("beginner");
  const [durationMinutes, setDurationMinutes] = useState<FormalPracticeConfig["durationMinutes"]>(10);
  const [replyLanguageMode, setReplyLanguageMode] = useState<FormalPracticeConfig["replyLanguageMode"]>("beginner");
  const [config, setConfig] = useState<FormalPracticeConfig | null>(null);
  const [summary, setSummary] = useState<FormalPracticeSummary | null>(null);
  const [micStatus, setMicStatus] = useState<"idle" | "checking" | "ready" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function startPractice() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicStatus("error");
      setErrorMessage("当前浏览器不支持麦克风，请使用最新版 Chrome、Edge 或 Safari。");
      return;
    }

    setMicStatus("checking");
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      const nextConfig: FormalPracticeConfig = {
        scenario,
        difficulty,
        durationMinutes,
        replyLanguageMode,
      };
      setConfig(nextConfig);
      setMicStatus("ready");
      setPhase("session");
    } catch {
      setMicStatus("error");
      setErrorMessage("没有获得麦克风权限，请允许访问麦克风后再开始正式练习。");
    }
  }

  if (phase === "session" && config) {
    return (
      <ConversationAiExperience
        variant="formal"
        formalConfig={config}
        onFormalFinish={(result) => {
          setSummary(result);
          setPhase("summary");
        }}
      />
    );
  }

  if (phase === "summary" && summary) {
    const totalTurns = Math.max(summary.userTurns, summary.assistantTurns);
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <section
          className="app-card overflow-hidden rounded-[2rem] border p-6 sm:p-8"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ color: "var(--app-success)", backgroundColor: "var(--app-card-bg)" }}>
            <CheckCircle2 size={26} />
          </span>
          <p className="mt-6 text-xs font-black tracking-[0.14em]" style={{ color: "var(--app-success)" }}>正式练习完成</p>
          <h1 className="mt-2 text-3xl font-black">{summary.config.scenario}</h1>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="app-card rounded-2xl border p-4">
              <Clock3 size={17} style={{ color: "var(--app-secondary)" }} />
              <p className="mt-3 text-2xl font-black">{formatDuration(summary.elapsedSeconds)}</p>
              <p className="app-muted-text mt-1 text-xs font-black">练习时间</p>
            </div>
            <div className="app-card rounded-2xl border p-4">
              <MessageCircleMore size={17} style={{ color: "var(--app-accent)" }} />
              <p className="mt-3 text-2xl font-black">{totalTurns}</p>
              <p className="app-muted-text mt-1 text-xs font-black">交流轮次</p>
            </div>
            <div className="app-card rounded-2xl border p-4">
              <Sparkles size={17} style={{ color: "var(--app-warm)" }} />
              <p className="mt-3 text-2xl font-black">
                {summary.config.difficulty === "beginner" ? "初级" : summary.config.difficulty === "intermediate" ? "中级" : "高级"}
              </p>
              <p className="app-muted-text mt-1 text-xs font-black">练习难度</p>
            </div>
          </div>

          <div className="app-card mt-5 rounded-2xl border p-5">
            <h2 className="font-black">本次建议</h2>
            <p className="app-muted-text mt-2 text-sm font-bold leading-7">
              {totalTurns >= 5
                ? "已经完成多轮交流。下一次可以减少中文辅助，尝试用更完整的韩语句子继续话题。"
                : "本次交流轮次较少。下一次建议保持同一话题，多追问或补充两个细节。"}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setSummary(null);
                setConfig(null);
                setMicStatus("ready");
                setPhase("setup");
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black text-white"
              style={{ backgroundColor: "var(--app-secondary)" }}
            >
              <RotateCcw size={15} />再练一次
            </button>
            <Link
              href="/dashboard/conversation-practice/ai-experience"
              className="app-card inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-black"
            >
              返回 AI 交流 <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="app-card overflow-hidden rounded-[2rem] border">
        <header className="p-6 sm:p-8" style={{ backgroundColor: "var(--app-secondary-soft)" }}>
          <h2 className="text-3xl font-black">准备本次练习</h2>
        </header>

        <div className="space-y-7 p-6 sm:p-8">
          <fieldset>
            <legend className="text-sm font-black">练习情境</legend>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {scenarios.map((item) => (
                <button key={item} type="button" onClick={() => setScenario(item)} className="rounded-xl border px-3 py-3 text-sm font-black transition" style={{ color: scenario === item ? "white" : "var(--app-text)", borderColor: scenario === item ? "var(--app-secondary)" : "var(--app-border)", backgroundColor: scenario === item ? "var(--app-secondary)" : "var(--app-soft-bg)" }}>{item}</button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-7 md:grid-cols-2">
            <fieldset>
              <legend className="text-sm font-black">难度</legend>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {difficulties.map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setDifficulty(value)} className="rounded-xl border px-3 py-3 text-sm font-black" style={{ color: difficulty === value ? "white" : "var(--app-text)", backgroundColor: difficulty === value ? "var(--app-accent)" : "var(--app-soft-bg)" }}>{label}</button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-black">练习时间</legend>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {durations.map((value) => (
                  <button key={value} type="button" onClick={() => setDurationMinutes(value)} className="rounded-xl border px-3 py-3 text-sm font-black" style={{ color: durationMinutes === value ? "white" : "var(--app-text)", backgroundColor: durationMinutes === value ? "var(--app-warm)" : "var(--app-soft-bg)" }}>{value} 分钟</button>
                ))}
              </div>
            </fieldset>
          </div>

          <fieldset>
            <legend className="text-sm font-black">回答方式</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {replyModes.map(([value, label]) => (
                <button key={value} type="button" onClick={() => setReplyLanguageMode(value)} className="rounded-xl border px-3 py-3 text-sm font-black" style={{ color: replyLanguageMode === value ? "white" : "var(--app-text)", backgroundColor: replyLanguageMode === value ? "var(--app-success)" : "var(--app-soft-bg)" }}>{label}</button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center" style={{ borderColor: "var(--app-border-soft)" }}>
            <span className="inline-flex flex-1 items-center gap-2 text-xs font-black" style={{ color: micStatus === "error" ? "var(--app-warm)" : micStatus === "ready" ? "var(--app-success)" : "var(--app-muted)" }}>
              <Mic size={14} />
              {micStatus === "checking" ? "正在检测麦克风" : micStatus === "ready" ? "麦克风可用" : micStatus === "error" ? "麦克风不可用" : "开始时检测麦克风"}
            </span>
            <button
              type="button"
              onClick={startPractice}
              disabled={micStatus === "checking"}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm font-black text-white disabled:opacity-50"
              style={{ backgroundColor: "#647abd" }}
            >
              <Timer size={16} />检测麦克风并开始
            </button>
          </div>

          {errorMessage && <p className="text-sm font-bold" role="alert" style={{ color: "var(--app-warm)" }}>{errorMessage}</p>}
        </div>
      </section>
    </div>
  );
}
