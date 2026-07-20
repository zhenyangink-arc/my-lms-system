"use client";

import { useActionState } from "react";
import { BookOpenCheck, Save, Send } from "lucide-react";

import { initialConversationPracticeActionState } from "@/app/dashboard/conversation-practice/action-state";
import { createConversationScenarioAction, updateConversationScenarioAction } from "@/app/dashboard/conversation-practice/actions";
import {
  CONVERSATION_CATEGORY_LABELS,
  CONVERSATION_DIFFICULTY_LABELS,
  CONVERSATION_STATUS_LABELS,
  type ConversationCategory,
  type ConversationDifficulty,
  type ConversationStatus,
  type DialogueLine,
  type KeyExpression,
} from "@/app/dashboard/conversation-practice/config";

export type ConversationScenarioFormValue = {
  id: string;
  title: string;
  description: string;
  category: ConversationCategory;
  difficulty: ConversationDifficulty;
  situation: string;
  learning_objectives: string[];
  sample_dialogue: DialogueLine[];
  key_expressions: KeyExpression[];
  starter_prompt: string;
  practice_tips: string;
  duration_minutes: number;
  status: ConversationStatus;
  is_featured: boolean;
  sort_order: number;
};

export function ConversationScenarioForm({ scenario }: { scenario?: ConversationScenarioFormValue }) {
  const action = scenario ? updateConversationScenarioAction.bind(null, scenario.id) : createConversationScenarioAction;
  const [state, formAction, pending] = useActionState(action, initialConversationPracticeActionState);

  return (
    <section id={scenario ? "edit-scenario" : "create-scenario"} className="app-card rounded-3xl border p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><BookOpenCheck size={20} /></span>
        <div><h2 className="text-lg font-black">{scenario ? "编辑会话场景" : "新建会话场景"}</h2><p className="app-muted-text mt-1 text-xs leading-5">先整理情景、示范对话和重点表达，再决定保存草稿或发布。</p></div>
      </div>

      <form action={formAction} className="mt-6 space-y-5">
        {scenario && <input type="hidden" name="status" value={scenario.status} />}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs font-black md:col-span-2">场景标题
            <input name="title" required minLength={2} maxLength={100} defaultValue={scenario?.title} placeholder="例如：在咖啡店点餐" className="app-input mt-2 w-full rounded-xl border px-4 py-3 text-sm" />
          </label>
          <label className="text-xs font-black">分类
            <select name="category" defaultValue={scenario?.category ?? "daily"} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm font-bold">
              {Object.entries(CONVERSATION_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs font-black">难度
            <select name="difficulty" defaultValue={scenario?.difficulty ?? "beginner"} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm font-bold">
              {Object.entries(CONVERSATION_DIFFICULTY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs font-black md:col-span-2">场景简介
            <textarea name="description" maxLength={500} rows={3} defaultValue={scenario?.description} placeholder="学生在列表中看到的简短说明。" className="app-input mt-2 w-full resize-y rounded-xl border px-4 py-3 text-sm leading-6" />
          </label>
          <label className="text-xs font-black md:col-span-2">情景说明
            <textarea name="situation" maxLength={1500} rows={4} defaultValue={scenario?.situation} placeholder="说明人物、地点、目标和需要完成的交流任务。" className="app-input mt-2 w-full resize-y rounded-xl border px-4 py-3 text-sm leading-6" />
          </label>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <label className="text-xs font-black">学习目标（每行一条）
            <textarea name="learning_objectives" rows={6} defaultValue={scenario?.learning_objectives.join("\n")} placeholder={'能够礼貌地点单\n能够询问价格与数量'} className="app-input mt-2 w-full resize-y rounded-xl border px-4 py-3 text-sm leading-6" />
          </label>
          <label className="text-xs font-black">重点表达（每行：韩语｜中文）
            <textarea name="key_expressions" rows={6} defaultValue={scenario?.key_expressions.map((item) => `${item.korean}|${item.chinese}`).join("\n")} placeholder={'아메리카노 한 잔 주세요.|请给我一杯美式咖啡。\n얼마예요?|多少钱？'} className="app-input mt-2 w-full resize-y rounded-xl border px-4 py-3 text-sm leading-6" />
          </label>
        </div>

        <label className="block text-xs font-black">示范对话（每行：角色｜韩语｜中文）
          <textarea name="sample_dialogue" rows={10} defaultValue={scenario?.sample_dialogue.map((item) => `${item.speaker}|${item.korean}|${item.chinese}`).join("\n")} placeholder={'店员|어서 오세요. 무엇을 드릴까요?|欢迎光临，请问您要点什么？\n学生|아메리카노 한 잔 주세요.|请给我一杯美式咖啡。'} className="app-input mt-2 w-full resize-y rounded-xl border px-4 py-3 font-mono text-sm leading-6" />
        </label>

        <div className="grid gap-4 xl:grid-cols-2">
          <label className="text-xs font-black">开场任务
            <textarea name="starter_prompt" maxLength={1000} rows={4} defaultValue={scenario?.starter_prompt} placeholder="例如：你是顾客，请先向店员问好，然后点一杯饮料。" className="app-input mt-2 w-full resize-y rounded-xl border px-4 py-3 text-sm leading-6" />
          </label>
          <label className="text-xs font-black">练习提示
            <textarea name="practice_tips" maxLength={1500} rows={4} defaultValue={scenario?.practice_tips} placeholder="提示语气、发音、替换词或进阶挑战。" className="app-input mt-2 w-full resize-y rounded-xl border px-4 py-3 text-sm leading-6" />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-xs font-black">建议时长（分钟）
            <input type="number" name="duration_minutes" min={1} max={120} defaultValue={scenario?.duration_minutes ?? 10} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm" />
          </label>
          <label className="text-xs font-black">显示顺序
            <input type="number" name="sort_order" min={0} max={100000} defaultValue={scenario?.sort_order ?? 0} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm" />
          </label>
          <label className="app-soft-card mt-auto flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-xs font-bold">
            <input type="checkbox" name="is_featured" defaultChecked={scenario?.is_featured} className="h-4 w-4" /> 设为推荐场景
          </label>
        </div>

        {scenario && <p className="app-muted-text text-xs">当前状态：{CONVERSATION_STATUS_LABELS[scenario.status]}。保存内容不会自动改变发布状态。</p>}
        {state.message && <p aria-live="polite" className="rounded-xl px-4 py-3 text-xs font-bold" style={{ color: state.status === "error" ? "#c94f45" : "var(--app-success)", backgroundColor: state.status === "error" ? "#fff0ed" : "var(--app-success-soft)" }}>{state.message}</p>}

        <div className="flex flex-wrap gap-2">
          {scenario ? (
            <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white disabled:opacity-50" style={{ backgroundColor: "var(--app-accent)" }}><Save size={15} />{pending ? "正在保存…" : "保存修改"}</button>
          ) : (
            <>
              <button type="submit" name="intent" value="publish" disabled={pending} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white disabled:opacity-50" style={{ backgroundColor: "var(--app-accent)" }}><Send size={15} />{pending ? "正在保存…" : "保存并发布"}</button>
              <button type="submit" name="intent" value="draft" disabled={pending} className="app-soft-card inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-black disabled:opacity-50"><Save size={15} />保存草稿</button>
            </>
          )}
        </div>
      </form>
    </section>
  );
}
