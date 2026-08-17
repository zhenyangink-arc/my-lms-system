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

const fieldClass =
  "app-input w-full rounded-md border px-3 py-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2";
const headerCellClass =
  "w-36 bg-[var(--surface-soft)] px-3 py-3 text-left text-[11px] font-semibold align-top";
const valueCellClass = "px-3 py-3 align-top";

export function ConversationScenarioForm({
  scenario,
  workspace = false,
}: {
  scenario?: ConversationScenarioFormValue;
  workspace?: boolean;
}) {
  const action = scenario ? updateConversationScenarioAction.bind(null, scenario.id) : createConversationScenarioAction;
  const [state, formAction, pending] = useActionState(action, initialConversationPracticeActionState);

  return (
    <section id={scenario ? "edit-scenario" : "create-scenario"} className={workspace ? "" : "app-card rounded-3xl border p-4 sm:p-5"}>
      {workspace ? (
        <div className="border-b pb-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-[13px] font-semibold">{scenario ? "场景内容" : "新建会话场景"}</h2>
          <p className="app-muted-text mt-1 text-[10px]">填写基本信息、练习内容和发布设置</p>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color: "var(--primary)", backgroundColor: "var(--accent)" }}><BookOpenCheck size={20} aria-hidden="true" /></span>
          <div><h2 className="text-lg font-semibold">{scenario ? "编辑会话场景" : "新建会话场景"}</h2><p className="app-muted-text mt-1 text-xs leading-5">先整理情景、示范对话和重点表达，再决定保存草稿或发布。</p></div>
        </div>
      )}

      <form action={formAction} className="mt-5 space-y-4">
        {scenario && <input type="hidden" name="status" value={scenario.status} />}
        <div className="overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] table-fixed border-collapse text-left">
              <tbody className="divide-y">
                <tr>
                  <th colSpan={4} className="bg-[var(--surface-soft)] px-3 py-2.5 text-[11px] font-semibold" style={{ color: "var(--primary-hover)" }}>基础信息</th>
                </tr>
                <tr>
                  <th className={headerCellClass}><label htmlFor="conversation-title">场景标题</label></th>
                  <td colSpan={3} className={valueCellClass}><input id="conversation-title" name="title" required minLength={2} maxLength={100} defaultValue={scenario?.title} placeholder="例如：在咖啡店点餐" className={fieldClass} /></td>
                </tr>
                <tr>
                  <th className={headerCellClass}><label htmlFor="conversation-category">分类</label></th>
                  <td className={valueCellClass}>
                    <select id="conversation-category" name="category" defaultValue={scenario?.category ?? "daily"} className={`${fieldClass} font-bold`}>
                      {Object.entries(CONVERSATION_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </td>
                  <th className={`${headerCellClass} border-l`}><label htmlFor="conversation-difficulty">难度</label></th>
                  <td className={valueCellClass}>
                    <select id="conversation-difficulty" name="difficulty" defaultValue={scenario?.difficulty ?? "beginner"} className={`${fieldClass} font-bold`}>
                      {Object.entries(CONVERSATION_DIFFICULTY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </td>
                </tr>
                <tr>
                  <th className={headerCellClass}><label htmlFor="conversation-description">场景简介</label></th>
                  <td colSpan={3} className={valueCellClass}><textarea id="conversation-description" name="description" maxLength={500} rows={3} defaultValue={scenario?.description} placeholder="学生在列表中看到的简短说明。" className={`${fieldClass} resize-y leading-5`} /></td>
                </tr>
                <tr>
                  <th className={headerCellClass}><label htmlFor="conversation-situation">情景说明</label></th>
                  <td colSpan={3} className={valueCellClass}><textarea id="conversation-situation" name="situation" maxLength={1500} rows={4} defaultValue={scenario?.situation} placeholder="说明人物、地点、目标和需要完成的交流任务。" className={`${fieldClass} resize-y leading-5`} /></td>
                </tr>

                <tr>
                  <th colSpan={4} className="bg-[var(--surface-soft)] px-3 py-2.5 text-[11px] font-semibold" style={{ color: "var(--primary-hover)" }}>练习内容</th>
                </tr>
                <tr>
                  <th className={headerCellClass}><label htmlFor="conversation-objectives">学习目标</label><span className="app-muted-text mt-1 block text-[9px] font-medium">每行一条</span></th>
                  <td className={valueCellClass}><textarea id="conversation-objectives" name="learning_objectives" rows={6} defaultValue={scenario?.learning_objectives.join("\n")} placeholder={'能够礼貌地点单\n能够询问价格与数量'} className={`${fieldClass} resize-y leading-5`} /></td>
                  <th className={`${headerCellClass} border-l`}><label htmlFor="conversation-expressions">重点表达</label><span className="app-muted-text mt-1 block text-[9px] font-medium">韩语｜中文</span></th>
                  <td className={valueCellClass}><textarea id="conversation-expressions" name="key_expressions" rows={6} defaultValue={scenario?.key_expressions.map((item) => `${item.korean}|${item.chinese}`).join("\n")} placeholder={'아메리카노 한 잔 주세요.|请给我一杯美式咖啡。\n얼마예요?|多少钱？'} className={`${fieldClass} resize-y leading-5`} /></td>
                </tr>
                <tr>
                  <th className={headerCellClass}><label htmlFor="conversation-dialogue">示范对话</label><span className="app-muted-text mt-1 block text-[9px] font-medium">角色｜韩语｜中文</span></th>
                  <td colSpan={3} className={valueCellClass}><textarea id="conversation-dialogue" name="sample_dialogue" rows={9} defaultValue={scenario?.sample_dialogue.map((item) => `${item.speaker}|${item.korean}|${item.chinese}`).join("\n")} placeholder={'店员|어서 오세요. 무엇을 드릴까요?|欢迎光临，请问您要点什么？\n学生|아메리카노 한 잔 주세요.|请给我一杯美式咖啡。'} className={`${fieldClass} resize-y font-mono leading-5`} /></td>
                </tr>
                <tr>
                  <th className={headerCellClass}><label htmlFor="conversation-starter">开场任务</label></th>
                  <td className={valueCellClass}><textarea id="conversation-starter" name="starter_prompt" maxLength={1000} rows={4} defaultValue={scenario?.starter_prompt} placeholder="例如：你是顾客，请先向店员问好，然后点一杯饮料。" className={`${fieldClass} resize-y leading-5`} /></td>
                  <th className={`${headerCellClass} border-l`}><label htmlFor="conversation-tips">练习提示</label></th>
                  <td className={valueCellClass}><textarea id="conversation-tips" name="practice_tips" maxLength={1500} rows={4} defaultValue={scenario?.practice_tips} placeholder="提示语气、发音、替换词或进阶挑战。" className={`${fieldClass} resize-y leading-5`} /></td>
                </tr>

                <tr>
                  <th colSpan={4} className="bg-[var(--surface-soft)] px-3 py-2.5 text-[11px] font-semibold" style={{ color: "var(--primary-hover)" }}>发布设置</th>
                </tr>
                <tr>
                  <th className={headerCellClass}><label htmlFor="conversation-duration">建议时长</label></th>
                  <td className={valueCellClass}><div className="flex items-center gap-2"><input id="conversation-duration" type="number" name="duration_minutes" min={1} max={120} defaultValue={scenario?.duration_minutes ?? 10} className={fieldClass} /><span className="app-muted-text shrink-0 text-[10px]">分钟</span></div></td>
                  <th className={`${headerCellClass} border-l`}><label htmlFor="conversation-sort">显示顺序</label></th>
                  <td className={valueCellClass}><input id="conversation-sort" type="number" name="sort_order" min={0} max={100000} defaultValue={scenario?.sort_order ?? 0} className={fieldClass} /></td>
                </tr>
                <tr>
                  <th className={headerCellClass}>推荐设置</th>
                  <td className={valueCellClass}><label className="inline-flex cursor-pointer items-center gap-2 text-[11px] font-bold"><input type="checkbox" name="is_featured" defaultChecked={scenario?.is_featured} className="h-4 w-4" />设为推荐场景</label></td>
                  <th className={`${headerCellClass} border-l`}>发布状态</th>
                  <td className={`${valueCellClass} text-[11px] font-bold`}>{scenario ? CONVERSATION_STATUS_LABELS[scenario.status] : "由下方保存按钮决定"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {state.message && <p aria-live="polite" className="rounded-xl px-4 py-3 text-xs font-bold" style={{ color: state.status === "error" ? "var(--status-danger)" : "var(--status-success)", backgroundColor: state.status === "error" ? "var(--status-danger-surface)" : "var(--status-success-surface)" }}>{state.message}</p>}

        <div className="sticky bottom-0 flex flex-wrap gap-2 border-t bg-[var(--card)] py-3" style={{ borderColor: "var(--border)" }}>
          {scenario ? (
            <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:opacity-50" style={{ backgroundColor: "var(--primary)" }}><Save size={15} aria-hidden="true" />{pending ? "正在保存…" : "保存修改"}</button>
          ) : (
            <>
              <button type="submit" name="intent" value="publish" disabled={pending} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:opacity-50" style={{ backgroundColor: "var(--primary)" }}><Send size={15} aria-hidden="true" />{pending ? "正在保存…" : "保存并发布"}</button>
              <button type="submit" name="intent" value="draft" disabled={pending} className="app-soft-card inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:opacity-50"><Save size={15} aria-hidden="true" />保存草稿</button>
            </>
          )}
        </div>
      </form>
    </section>
  );
}
