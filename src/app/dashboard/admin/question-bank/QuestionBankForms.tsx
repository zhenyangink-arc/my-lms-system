"use client";

import {
  BookPlus,
  PencilLine,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import type {
  StandardQuestion,
  StandardQuestionGroup,
} from "@/lib/question-bank";
import {
  deleteStandardQuestionAction,
  saveStandardQuestionAction,
} from "./actions";
import type { QuestionBankActionState } from "./actions";
import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import { KOREAN_EBOOK_SECTIONS, koreanEbookSectionLabel } from "@/lib/korean-ebook-sections";

const initialQuestionBankActionState: QuestionBankActionState = {
  status: "idle",
  message: "",
};

const fieldClass =
  "app-input w-full rounded-md border px-3 py-2.5 text-xs";

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function ActionMessage({
  state,
}: {
  state: typeof initialQuestionBankActionState;
}) {
  if (!state.message) return null;
  return (
    <p
      aria-live="polite"
      className="border px-3 py-2 text-xs font-bold"
      style={{
        color:
          state.status === "error" ? "#c94f45" : "var(--app-success)",
        backgroundColor:
          state.status === "error" ? "#fff0ed" : "var(--app-success-soft)",
      }}
    >
      {state.message}
    </p>
  );
}

function QuestionFields({
  groups,
  question,
  lockedGroup,
}: {
  groups: StandardQuestionGroup[];
  question?: StandardQuestion;
  lockedGroup?: StandardQuestionGroup;
}) {
  const options = stringArray(question?.options);

  return (
    <>
      <input type="hidden" name="question_id" value={question?.id ?? ""} />
      <input type="hidden" name="question_type" value="single_choice" />
      <input type="hidden" name="correct_answer" value="" />
      <div className="overflow-x-auto border">
        <table className="w-full min-w-[820px] border-collapse text-left text-xs">
          <tbody className="divide-y">
            <tr>
              <th className="w-32 bg-[var(--app-soft-bg)] px-3 py-3 font-black">课程章节</th>
              <td className="px-3 py-3">
                {lockedGroup ? (
                  <>
                    <input type="hidden" name="test_id" value={lockedGroup.id} />
                    <span className="font-bold">{lockedGroup.curriculum_label ?? `第 ${lockedGroup.chapter_number} 章 · ${lockedGroup.title}`}</span>
                  </>
                ) : (
                  <select name="test_id" required defaultValue={question?.test_id ?? groups[0]?.id ?? ""} className={fieldClass}>
                    {groups.map((group) => <option key={group.id} value={group.id}>{group.curriculum_label ?? `第 ${group.chapter_number} 章 · ${group.title}`}</option>)}
                  </select>
                )}
              </td>
              <th className="w-32 border-l bg-[var(--app-soft-bg)] px-3 py-3 font-black">题型</th>
              <td className="px-3 py-3 font-bold">单选题 · 四个选项</td>
            </tr>
            <tr>
              <th className="bg-[var(--app-soft-bg)] px-3 py-3 font-black">电子书目录</th>
              <td className="px-3 py-3">
                <select name="ebook_section_step" required defaultValue={question?.ebook_section_step ?? "STEP 08"} className={fieldClass}>
                  {KOREAN_EBOOK_SECTIONS.map((section) => <option key={section.step} value={section.step}>{koreanEbookSectionLabel(section.step)}</option>)}
                </select>
              </td>
              <th className="border-l bg-[var(--app-soft-bg)] px-3 py-3 font-black">电子书页码</th>
              <td className="px-3 py-3"><input name="ebook_page_reference" maxLength={80} defaultValue={question?.ebook_page_reference ?? ""} placeholder="例如：第 9—12 页" className={fieldClass} /></td>
            </tr>
            <tr>
              <th className="bg-[var(--app-soft-bg)] px-3 py-3 font-black">难度</th>
              <td className="px-3 py-3"><select name="difficulty" defaultValue={question?.difficulty ?? "foundation"} className={fieldClass}><option value="foundation">基础</option><option value="medium">中等</option></select></td>
              <th className="border-l bg-[var(--app-soft-bg)] px-3 py-3 font-black">默认分值</th>
              <td className="px-3 py-3"><input name="default_points" type="number" min="0.5" max="1000" step="0.5" required defaultValue={question?.default_points ?? 10} className={fieldClass} /></td>
            </tr>
            <tr>
              <th className="bg-[var(--app-soft-bg)] px-3 py-3 font-black">题目</th>
              <td colSpan={3} className="px-3 py-3"><textarea name="prompt" required maxLength={3000} rows={3} defaultValue={question?.prompt ?? ""} placeholder="输入标准题目或作答要求" className={`${fieldClass} resize-y leading-6`} /></td>
            </tr>
            <tr>
              <th className="bg-[var(--app-soft-bg)] px-3 py-3 font-black">四个选项</th>
              <td className="px-3 py-3"><textarea name="options_text" required rows={5} defaultValue={options.join("\n")} placeholder={"选项一\n选项二\n选项三\n选项四"} className={`${fieldClass} leading-6`} /></td>
              <th className="border-l bg-[var(--app-soft-bg)] px-3 py-3 font-black">正确选项序号</th>
              <td className="px-3 py-3"><input name="correct_option_number" required type="number" min={1} max={4} defaultValue={question?.correct_option == null ? 1 : question.correct_option + 1} className={fieldClass} /><span className="app-muted-text mt-1.5 block text-[10px]">按选项顺序填写 1 至 4</span></td>
            </tr>
            <tr>
              <th className="bg-[var(--app-soft-bg)] px-3 py-3 font-black">知识点</th>
              <td className="px-3 py-3"><input name="skill" required maxLength={80} defaultValue={question?.skill ?? ""} placeholder="例如：grammar" className={fieldClass} /></td>
              <th className="border-l bg-[var(--app-soft-bg)] px-3 py-3 font-black">标签</th>
              <td className="px-3 py-3"><input name="tags_text" defaultValue={stringArray(question?.tags).join("，")} placeholder="逗号分隔" className={fieldClass} /></td>
            </tr>
            <tr>
              <th className="bg-[var(--app-soft-bg)] px-3 py-3 font-black">标准解析</th>
              <td colSpan={3} className="px-3 py-3"><textarea name="explanation" maxLength={3000} rows={3} defaultValue={question?.explanation ?? ""} className={`${fieldClass} leading-6`} /></td>
            </tr>
            <tr>
              <th className="bg-[var(--app-soft-bg)] px-3 py-3 font-black">发布状态</th>
              <td colSpan={3} className="px-3 py-3"><select name="status" defaultValue={question?.status ?? "draft"} className={`${fieldClass} max-w-sm`}><option value="draft">草稿</option><option value="published">已发布</option><option value="archived">已归档</option></select></td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

export function CreateStandardQuestionForm({
  groups,
  lockedGroup,
}: {
  groups: StandardQuestionGroup[];
  lockedGroup: StandardQuestionGroup;
}) {
  const [state, formAction, pending] = useActionState(
    saveStandardQuestionAction,
    initialQuestionBankActionState
  );

  return (
    <section className="border-y py-4">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 text-[var(--app-accent)]"
        >
          <BookPlus size={19} />
        </span>
        <div>
          <DashboardTitleWithHint headingLevel={2} titleClassName="text-lg font-black" title={<>新增标准题目</>} description={<>新题先保存为草稿，确认答案和解析后再发布给机构使用。</>} />
        </div>
      </div>
      <form action={formAction} className="mt-5 space-y-4">
        <QuestionFields groups={groups} lockedGroup={lockedGroup} />
        <ActionMessage state={state} />
        <button
          type="submit"
          disabled={pending || groups.length === 0}
          className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--app-accent)" }}
        >
          <Save size={15} />
          {pending ? "正在保存…" : "保存标准题目"}
        </button>
      </form>
    </section>
  );
}

function DeleteStandardQuestionButton({ questionId }: { questionId: string }) {
  const [state, formAction, pending] = useActionState(
    deleteStandardQuestionAction.bind(null, questionId),
    initialQuestionBankActionState
  );

  return (
    <div>
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!window.confirm("确定删除这道标准题吗？已生成的作业快照不会改变。")) {
            event.preventDefault();
          }
        }}
      >
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black disabled:opacity-50"
          style={{ color: "#c94f45", backgroundColor: "#fff0ed" }}
        >
          <Trash2 size={13} />
          {pending ? "删除中…" : "删除"}
        </button>
      </form>
      <ActionMessage state={state} />
    </div>
  );
}

export function EditStandardQuestionForm({
  groups,
  question,
  compact = false,
}: {
  groups: StandardQuestionGroup[];
  question: StandardQuestion;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    saveStandardQuestionAction,
    initialQuestionBankActionState
  );
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (state.status === "success") dialogRef.current?.close();
  }, [state.status]);

  return (
    <div
      className={compact ? "flex justify-end" : "mt-4 flex justify-end border-t pt-3"}
      style={{ borderColor: "var(--app-border-soft)" }}
    >
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-black"
        style={{ color: "var(--app-accent)" }}
      >
        <PencilLine size={13} />
        编辑标准题目
      </button>

      <dialog
        ref={dialogRef}
        aria-label="编辑标准题目"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        className="m-auto max-h-[90dvh] w-[min(1100px,calc(100vw-2rem))] overflow-hidden border p-0 shadow-2xl backdrop:bg-black/45"
        style={{
          color: "var(--app-text)",
          backgroundColor: "var(--app-card-bg)",
          borderColor: "var(--app-border)",
        }}
      >
        <div
          className="flex items-center gap-3 border-b px-5 py-4 sm:px-6"
          style={{ borderColor: "var(--app-border-soft)" }}
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              color: "var(--app-accent)",
              backgroundColor: "var(--app-accent-soft)",
            }}
          >
            <PencilLine size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-black">编辑标准题目</h2>
            <p className="app-muted-text mt-0.5 truncate text-xs">
              保存后自动生成新版本，机构已创建的作业快照不会改变。
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-md border p-2.5"
            aria-label="关闭编辑对话框"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[calc(90dvh-74px)] overflow-y-auto p-5 sm:p-6">
          <form action={formAction} className="space-y-4">
            <QuestionFields groups={groups} question={question} />
            <ActionMessage state={state} />
            <div
              className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"
              style={{ borderColor: "var(--app-border-soft)" }}
            >
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="rounded-md border px-4 py-2.5 text-xs font-black"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
                style={{ backgroundColor: "var(--app-accent)" }}
              >
                <Save size={14} />
                {pending ? "正在更新…" : "保存并生成新版本"}
              </button>
            </div>
          </form>
          <div
            className="mt-5 flex items-center justify-between gap-3 border-t pt-4"
            style={{ borderColor: "var(--app-border-soft)" }}
          >
            <p className="app-muted-text text-xs">
              删除只影响标准题库，不改变已经生成的作业快照。
            </p>
            <DeleteStandardQuestionButton questionId={question.id} />
          </div>
        </div>
      </dialog>
    </div>
  );
}
