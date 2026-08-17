"use client";

import { useActionState } from "react";
import { CheckCircle2, Save } from "lucide-react";

import { initialConversationPracticeActionState } from "./action-state";
import { saveConversationPracticeProgressAction } from "./actions";
import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";

export function PracticeReflectionForm({
  scenarioId,
  confidence,
  reflection,
  completed,
}: {
  scenarioId: string;
  confidence: number | null;
  reflection: string;
  completed: boolean;
}) {
  const action = saveConversationPracticeProgressAction.bind(null, scenarioId);
  const [state, formAction, pending] = useActionState(action, initialConversationPracticeActionState);
  const confidenceError =
    state.status === "error" && state.message.includes("自信程度") ? state.message : null;
  const reflectionError =
    state.status === "error" && state.message.includes("练习复盘") ? state.message : null;
  const formMessage = confidenceError || reflectionError ? null : state.message;

  return (
    <form action={formAction} className="app-card rounded-3xl border p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color: "var(--status-success)", backgroundColor: "var(--status-success-surface)" }}>
          <CheckCircle2 size={20} aria-hidden="true" />
        </span>
        <div>
          <DashboardTitleWithHint headingLevel={2} titleClassName="text-lg font-bold" title={<>记录本次练习</>} description={<>每次保存都会累计练习次数，复盘内容可以继续修改。</>} />
        </div>
      </div>

      <fieldset className="mt-5" aria-describedby={confidenceError ? "confidence-error" : undefined}>
        <legend className="text-xs font-bold">这次开口的自信程度</legend>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="flex cursor-pointer flex-col items-center rounded-xl border bg-[var(--surface-soft)] px-2 py-3 text-xs font-bold">
              <input type="radio" name="confidence" value={value} defaultChecked={(confidence ?? 3) === value} className="mb-1.5 h-4 w-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2" />
              {value} 级
            </label>
          ))}
        </div>
        {confidenceError && <p id="confidence-error" role="alert" className="mt-2 text-xs font-bold" style={{ color: "var(--status-danger)" }}>{confidenceError}</p>}
      </fieldset>

      <label htmlFor="practice-reflection" className="mt-5 block text-xs font-bold">
        练习复盘
        <textarea id="practice-reflection" name="reflection" defaultValue={reflection} maxLength={1200} rows={5} placeholder="写下卡住的表达、发音问题，或者下次想改进的地方。" aria-invalid={Boolean(reflectionError)} aria-describedby={reflectionError ? "reflection-error" : undefined} className="app-input mt-2 w-full resize-y rounded-2xl border px-4 py-3 text-sm leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2" />
      </label>
      {reflectionError && <p id="reflection-error" role="alert" className="mt-2 text-xs font-bold" style={{ color: "var(--status-danger)" }}>{reflectionError}</p>}

      <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border bg-[var(--surface-soft)] px-4 py-3 text-xs font-bold">
        <input type="checkbox" name="completed" defaultChecked={completed} className="h-4 w-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2" />
        我已经能够独立完成这个情景会话
      </label>

      {formMessage && (
        <p role={state.status === "error" ? "alert" : "status"} aria-live="polite" className="mt-4 rounded-xl px-4 py-3 text-xs font-bold" style={{ color: state.status === "error" ? "var(--status-danger)" : "var(--status-success)", backgroundColor: state.status === "error" ? "var(--status-danger-surface)" : "var(--status-success-surface)" }}>
          {formMessage}
        </p>
      )}

      <button type="submit" disabled={pending} className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" style={{ color: "var(--primary-foreground)", backgroundColor: "var(--primary)" }}>
        <Save size={15} aria-hidden="true" /> {pending ? "正在保存…" : "保存练习记录"}
      </button>
    </form>
  );
}
