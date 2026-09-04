"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
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

const FORMAL_SETUP_STORAGE_KEY = "conversation-practice:formal-setup";

type StoredFormalSetup = {
  config: FormalPracticeConfig;
  sessionKey: string;
};

// 只在中途刷新/切走再回来时用来跳过设置页、直接恢复到练习中——实际的对话记录和
// 计时由 ConversationAiExperience 按 sessionKey 存取，这里只保存"用哪份配置"。
function readStoredFormalSetup(): StoredFormalSetup | null {
  try {
    const raw = sessionStorage.getItem(FORMAL_SETUP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredFormalSetup>;
    if (!parsed.sessionKey || !parsed.config || typeof parsed.config !== "object") return null;
    return { config: parsed.config as FormalPracticeConfig, sessionKey: parsed.sessionKey };
  } catch {
    return null;
  }
}

function clearStoredFormalSetup() {
  try {
    sessionStorage.removeItem(FORMAL_SETUP_STORAGE_KEY);
  } catch {
    // 隐私模式或存储不可用时静默跳过。
  }
}

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

export function FormalConversationPractice({ basePath }: { basePath: string }) {
  const [phase, setPhase] = useState<"setup" | "session" | "summary">("setup");
  const [scenario, setScenario] = useState<(typeof scenarios)[number]>("自由交流");
  const [difficulty, setDifficulty] = useState<FormalPracticeConfig["difficulty"]>("beginner");
  const [durationMinutes, setDurationMinutes] = useState<FormalPracticeConfig["durationMinutes"]>(10);
  const [replyLanguageMode, setReplyLanguageMode] = useState<FormalPracticeConfig["replyLanguageMode"]>("beginner");
  const [config, setConfig] = useState<FormalPracticeConfig | null>(null);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [summary, setSummary] = useState<FormalPracticeSummary | null>(null);
  const [micStatus, setMicStatus] = useState<"idle" | "checking" | "ready" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // sessionStorage 只能在挂载后读取（服务端渲染阶段没有这个对象，放进 useState
  // 初始值会导致 SSR 报错/水合不一致），所以恢复逻辑放在 effect 里，刷新后会有一瞬
  // "设置页"闪一下再跳回练习中，这是预期的，不是 bug。
  useEffect(() => {
    const stored = readStoredFormalSetup();
    if (!stored) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConfig(stored.config);
    setSessionKey(stored.sessionKey);
    setMicStatus("ready");
    setPhase("session");
  }, []);

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
      const nextSessionKey = crypto.randomUUID();
      setConfig(nextConfig);
      setSessionKey(nextSessionKey);
      setMicStatus("ready");
      setPhase("session");
      try {
        sessionStorage.setItem(
          FORMAL_SETUP_STORAGE_KEY,
          JSON.stringify({ config: nextConfig, sessionKey: nextSessionKey })
        );
      } catch {
        // 存储不可用时静默跳过，只影响刷新后能否恢复，不影响本次练习正常开始。
      }
    } catch {
      setMicStatus("error");
      setErrorMessage("没有获得麦克风权限，请允许访问麦克风后再开始正式练习。");
    }
  }

  if (phase === "session" && config) {
    return (
      <ConversationAiExperience
        variant="formal"
        basePath={basePath}
        formalConfig={config}
        formalSessionKey={sessionKey ?? undefined}
        onFormalFinish={(result) => {
          clearStoredFormalSetup();
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
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ color: "var(--status-success)", backgroundColor: "var(--card)" }}>
            <CheckCircle2 size={26} aria-hidden="true" />
          </span>
          <p className="mt-6 text-xs font-bold tracking-[0.14em]" style={{ color: "var(--status-success)" }}>正式练习完成</p>
          <h2 className="mt-2 text-3xl font-bold">{summary.config.scenario}</h2>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="app-card rounded-2xl border p-4">
              <Clock3 size={17} style={{ color: "var(--support)" }} aria-hidden="true" />
              <p className="mt-3 text-2xl font-bold">{formatDuration(summary.elapsedSeconds)}</p>
              <p className="app-muted-text mt-1 text-xs font-bold">练习时间</p>
            </div>
            <div className="app-card rounded-2xl border p-4">
              <MessageCircleMore size={17} style={{ color: "var(--primary)" }} aria-hidden="true" />
              <p className="mt-3 text-2xl font-bold">{totalTurns}</p>
              <p className="app-muted-text mt-1 text-xs font-bold">交流轮次</p>
            </div>
            <div className="app-card rounded-2xl border p-4">
              <Sparkles size={17} style={{ color: "var(--status-warning)" }} aria-hidden="true" />
              <p className="mt-3 text-2xl font-bold">
                {summary.config.difficulty === "beginner" ? "初级" : summary.config.difficulty === "intermediate" ? "中级" : "高级"}
              </p>
              <p className="app-muted-text mt-1 text-xs font-bold">练习难度</p>
            </div>
          </div>

          <div className="app-card mt-5 rounded-2xl border p-5">
            <h2 className="font-bold">本次建议</h2>
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
                clearStoredFormalSetup();
                setSummary(null);
                setConfig(null);
                setSessionKey(null);
                setMicStatus("ready");
                setPhase("setup");
              }}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
              style={{ color: "var(--status-warning-foreground)", backgroundColor: "var(--support)" }}
            >
              <RotateCcw size={15} aria-hidden="true" />再练一次
            </button>
            <Link
              href={`${basePath}/ai-experience`}
              className="app-card inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2"
            >
              返回智能交流 <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href={`${basePath}/ai-experience`} className="app-muted-text mb-4 inline-flex items-center gap-2 rounded-lg text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2">
        <ArrowLeft size={14} aria-hidden="true" />返回练习方式
      </Link>
      <section className="app-card overflow-hidden rounded-[2rem] border">
        <header className="p-6 sm:p-8" style={{ backgroundColor: "var(--support-surface)" }}>
          <h2 className="text-3xl font-bold">准备本次练习</h2>
        </header>

        <div className="space-y-7 p-6 sm:p-8">
          <fieldset>
            <legend className="text-sm font-bold">练习情境</legend>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {scenarios.map((item) => (
                <button key={item} type="button" onClick={() => setScenario(item)} aria-pressed={scenario === item} className="rounded-xl border px-3 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2" style={{ color: scenario === item ? "var(--status-warning-foreground)" : "var(--foreground)", borderColor: scenario === item ? "var(--support)" : "var(--border)", backgroundColor: scenario === item ? "var(--support)" : "var(--surface-soft)" }}>{item}</button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-7 md:grid-cols-2">
            <fieldset>
              <legend className="text-sm font-bold">难度</legend>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {difficulties.map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setDifficulty(value)} aria-pressed={difficulty === value} className="rounded-xl border px-3 py-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2" style={{ color: difficulty === value ? "var(--primary-foreground)" : "var(--foreground)", backgroundColor: difficulty === value ? "var(--primary)" : "var(--surface-soft)" }}>{label}</button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-bold">练习时间</legend>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {durations.map((value) => (
                  <button key={value} type="button" onClick={() => setDurationMinutes(value)} aria-pressed={durationMinutes === value} className="rounded-xl border px-3 py-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2" style={{ color: durationMinutes === value ? "var(--status-warning-foreground)" : "var(--foreground)", backgroundColor: durationMinutes === value ? "var(--status-warning)" : "var(--surface-soft)" }}>{value} 分钟</button>
                ))}
              </div>
            </fieldset>
          </div>

          <fieldset>
            <legend className="text-sm font-bold">回答方式</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {replyModes.map(([value, label]) => (
                <button key={value} type="button" onClick={() => setReplyLanguageMode(value)} aria-pressed={replyLanguageMode === value} className="rounded-xl border px-3 py-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2" style={{ color: replyLanguageMode === value ? "var(--status-success-foreground)" : "var(--foreground)", backgroundColor: replyLanguageMode === value ? "var(--status-success)" : "var(--surface-soft)" }}>{label}</button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center" style={{ borderColor: "var(--border-subtle)" }}>
            <span className="inline-flex flex-1 items-center gap-2 text-xs font-bold" style={{ color: micStatus === "error" ? "var(--status-danger)" : micStatus === "ready" ? "var(--status-success)" : "var(--foreground-muted)" }}>
              <Mic size={14} aria-hidden="true" />
              {micStatus === "checking" ? "正在检测麦克风" : micStatus === "ready" ? "麦克风可用" : micStatus === "error" ? "麦克风不可用" : "开始时检测麦克风"}
            </span>
            <button
              type="button"
              onClick={startPractice}
              disabled={micStatus === "checking"}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ color: "var(--primary-foreground)", backgroundColor: "var(--primary)" }}
            >
              <Timer size={16} aria-hidden="true" />检测麦克风并开始
            </button>
          </div>

          {errorMessage && <p className="text-sm font-bold" role="alert" style={{ color: "var(--status-danger)" }}>{errorMessage}</p>}
        </div>
      </section>
    </div>
  );
}
