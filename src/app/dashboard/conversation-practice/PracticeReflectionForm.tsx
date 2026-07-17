"use client";

import { useActionState } from "react";
import { CheckCircle2, Save } from "lucide-react";

import { initialConversationPracticeActionState } from "./action-state";
import { saveConversationPracticeProgressAction } from "./actions";

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

  return (
    <form action={formAction} className="app-card rounded-[28px] border p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color: "var(--app-success)", backgroundColor: "var(--app-success-soft)" }}>
          <CheckCircle2 size={20} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-black">记录本次练习</h2>
          <p className="app-muted-text mt-1 text-xs leading-6">每次保存都会累计练习次数，复盘内容可以继续修改。</p>
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="text-xs font-black">这次开口的自信程度</legend>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="app-soft-card flex cursor-pointer flex-col items-center rounded-xl border px-2 py-3 text-xs font-black">
              <input type="radio" name="confidence" value={value} defaultChecked={(confidence ?? 3) === value} className="mb-1.5 h-4 w-4" />
              {value} 级
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-5 block text-xs font-black">
        练习复盘
        <textarea name="reflection" defaultValue={reflection} maxLength={1200} rows={5} placeholder="写下卡住的表达、发音问题，或者下次想改进的地方。" className="app-input mt-2 w-full resize-y rounded-2xl border px-4 py-3 text-sm leading-7" />
      </label>

      <label className="app-soft-card mt-4 flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-xs font-bold">
        <input type="checkbox" name="completed" defaultChecked={completed} className="h-4 w-4" />
        我已经能够独立完成这个情景会话
      </label>

      {state.message && (
        <p aria-live="polite" className="mt-4 rounded-xl px-4 py-3 text-xs font-bold" style={{ color: state.status === "error" ? "#c94f45" : "var(--app-success)", backgroundColor: state.status === "error" ? "#fff0ed" : "var(--app-success-soft)" }}>
          {state.message}
        </p>
      )}

      <button type="submit" disabled={pending} className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white disabled:opacity-50" style={{ backgroundColor: "var(--app-accent)" }}>
        <Save size={15} aria-hidden="true" /> {pending ? "正在保存…" : "保存练习记录"}
      </button>
    </form>
  );
}
