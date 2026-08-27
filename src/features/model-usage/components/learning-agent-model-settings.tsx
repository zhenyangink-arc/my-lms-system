"use client";

import { useState } from "react";

import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import type { LearningAgentModelConfig } from "../api/types";
import {
  LEARNING_AGENT_MODEL_OPTIONS,
  type LearningAgentProvider,
} from "../model-options";

function AgentModelRow({ config }: { config: LearningAgentModelConfig }) {
  const [provider, setProvider] = useState<LearningAgentProvider>(config.provider);
  const [model, setModel] = useState(config.model);
  const [savedProvider, setSavedProvider] = useState(config.provider);
  const [savedModel, setSavedModel] = useState(config.model);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const hasChanges = provider !== savedProvider || model !== savedModel;

  const save = async () => {
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch("/api/admin/model-usage/learning-agent-model", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentCode: config.agentCode, provider, model }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "模型配置保存失败。");
      setSavedProvider(provider);
      setSavedModel(model);
      setStatus("saved");
      setMessage("已保存，新发起的教学请求将使用该模型。");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "模型配置保存失败。");
    }
  };

  return (
    <div className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 xl:grid-cols-[minmax(220px,1fr)_180px_minmax(220px,1fr)_auto] xl:items-end">
      <div className="min-w-0 self-center">
        <p className="font-semibold text-[var(--foreground)]">{config.displayName}</p>
        <p className="mt-1 font-mono text-xs text-[var(--foreground-muted)]">
          {config.agentCode}
        </p>
      </div>
      <label className="grid gap-1.5 text-xs font-medium text-[var(--foreground-secondary)]">
        模型供应商
        <select
          value={provider}
          onChange={(event) => {
            const nextProvider = event.target.value as LearningAgentProvider;
            setProvider(nextProvider);
            setModel(LEARNING_AGENT_MODEL_OPTIONS[nextProvider][0].value);
            setStatus("idle");
            setMessage("");
          }}
          className="h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <option value="qwen">Qwen</option>
          <option value="deepseek">DeepSeek</option>
        </select>
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-[var(--foreground-secondary)]">
        使用模型
        <select
          value={model}
          onChange={(event) => {
            setModel(event.target.value);
            setStatus("idle");
            setMessage("");
          }}
          className="h-10 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {LEARNING_AGENT_MODEL_OPTIONS[provider].map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!hasChanges || status === "saving"}
        onClick={save}
        className="h-10 min-w-24 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
      >
        {status === "saving" ? "正在保存" : "保存设置"}
      </button>
      {message && (
        <p
          role="status"
          className={`text-xs xl:col-start-2 xl:col-end-5 ${status === "error" ? "text-rose-700" : "text-emerald-700"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

export function LearningAgentModelSettings({
  configs,
}: {
  configs: LearningAgentModelConfig[];
}) {
  const orderedConfigs = [...configs].sort((left, right) => {
    if (left.agentCode === "uply-guide-agent") return -1;
    if (right.agentCode === "uply-guide-agent") return 1;
    return left.displayName.localeCompare(right.displayName, "zh-CN");
  });

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
      <CardTitleWithHint
        title="教学引擎配置"
        description="只有平台负责人可以查看和修改。保存后，新发起的教学请求会使用新模型，正在生成的回复不会被中断。"
        headingLevel={2}
        titleClassName="text-base font-bold text-[var(--foreground)]"
      />
      {orderedConfigs.length > 0 ? (
        <div className="space-y-3">
          {orderedConfigs.map((config) => (
            <AgentModelRow key={config.agentCode} config={config} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--foreground-muted)]">
          暂无已发布的教学 Agent 配置。
        </p>
      )}
    </section>
  );
}
