"use client";

import { FilePlus2, Pencil, Plus, Save, Send, X } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { MathQuestionEditor } from "./MathQuestionEditor";
import {
  MAX_QUESTIONS,
  QUESTION_KIND_LABELS,
  newPaper,
  newQuestion,
  deterministicWorkingSeed,
  validatePaperDraft,
  type DraftPaper,
  type DraftQuestion,
  type QuestionKind,
} from "./paper-model";

export type MathPaperLessonOption = { id: string; label: string };

/** 保存动作的返回值；与平台的 LearningAssignmentActionState 结构兼容（学科不引用 app 层）。 */
export type MathPaperActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type MathPaperAction = (
  previousState: MathPaperActionState,
  formData: FormData,
) => Promise<MathPaperActionState>;

const initialState: MathPaperActionState = { status: "idle", message: "" };

const fieldClass = "app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm";

/**
 * 平台负责人录入数学试卷。提交内容是整份草稿（draft_json），
 * 服务端动作会用同一份校验代码重新校验并生成判题种子；这里的校验只用于即时提示。
 */
/** 编辑已有草稿：整体替换（D8）。课时与试卷类型不可改，沿用原容器。 */
export type MathPaperEdit = {
  paperId: string;
  paperCode: string;
  initialDraft: DraftPaper;
  allowResubmission: boolean;
  lessonLabel: string;
};

export function MathPaperComposer({
  paperType,
  lessons,
  canPublish,
  createAction,
  edit,
}: {
  paperType: "homework" | "exam";
  lessons: MathPaperLessonOption[];
  canPublish: boolean;
  createAction: MathPaperAction;
  edit?: MathPaperEdit;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(createAction, initialState);
  const [draft, setDraft] = useState<DraftPaper>(
    () => edit?.initialDraft ?? { ...newPaper(), durationMinutes: paperType === "exam" ? "60" : "30" },
  );
  const [lessonId, setLessonId] = useState(lessons[0]?.id ?? "");
  const typeLabel = paperType === "homework" ? "作业" : "考试";

  useEffect(() => {
    if (state.status === "success") dialogRef.current?.close();
  }, [state]);

  // 即时校验用确定性的“可用种子”；真正的种子由服务端另外挑选并保存。
  const validation = useMemo(
    () =>
      validatePaperDraft(draft, (index) => {
        const question = draft.questions[index];
        return question && question.kind !== "choice" ? deterministicWorkingSeed(question) : 1;
      }),
    [draft],
  );
  const totalPoints = draft.questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);

  function updateQuestion(index: number, next: DraftQuestion) {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((q, i) => (i === index ? next : q)),
    }));
  }
  function addQuestion(kind: QuestionKind) {
    setDraft((current) =>
      current.questions.length >= MAX_QUESTIONS
        ? current
        : { ...current, questions: [...current.questions, newQuestion(kind)] },
    );
  }
  function moveQuestion(index: number, direction: -1 | 1) {
    setDraft((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.questions.length) return current;
      const questions = [...current.questions];
      [questions[index], questions[target]] = [questions[target], questions[index]];
      return { ...current, questions };
    });
  }

  const canSubmit = validation.ok && (edit !== undefined || lessonId !== "") && !pending;

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={
          edit
            ? "app-soft-card inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold"
            : "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
        }
        style={edit ? undefined : { backgroundColor: "var(--primary)" }}
      >
        {edit ? <Pencil size={14} /> : <FilePlus2 size={16} />}
        {edit ? "编辑草稿" : `新增数学${typeLabel}卷`}
      </button>

      <dialog
        ref={dialogRef}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        className="m-auto max-h-[92dvh] w-[min(1080px,calc(100%-2rem))] overflow-hidden rounded-3xl border bg-transparent p-0 shadow-2xl backdrop:bg-black/45"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="app-card max-h-[92dvh] overflow-y-auto rounded-3xl">
          <div
            className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6"
            style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--card)" }}
          >
            <h2 className="text-xl font-semibold">
              {edit ? `编辑数学${typeLabel}卷草稿 · ${edit.paperCode}` : `新增数学${typeLabel}卷`}
            </h2>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="app-soft-card flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
              aria-label="关闭新增试卷对话框"
            >
              <X size={18} />
            </button>
          </div>

          <form action={formAction} className="space-y-6 p-5 sm:p-6">
            <input type="hidden" name="draft_json" value={JSON.stringify(draft)} />
            {edit ? (
              <input type="hidden" name="paper_id" value={edit.paperId} />
            ) : (
              <input type="hidden" name="lesson_id" value={lessonId} />
            )}

            <section className="grid gap-4 md:grid-cols-2">
              <label className="text-xs font-semibold">
                试卷名称
                <input
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  maxLength={120}
                  placeholder={`例如：极限与连续${typeLabel}A卷`}
                  className={fieldClass}
                />
              </label>
              {edit ? (
                <div className="text-xs font-semibold">
                  所属课时
                  <p className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm font-normal">{edit.lessonLabel}</p>
                </div>
              ) : (
              <label className="text-xs font-semibold">
                所属课时（试卷挂在该课时的容器下）
                <select value={lessonId} onChange={(event) => setLessonId(event.target.value)} className={fieldClass}>
                  {lessons.length === 0 && <option value="">暂无数学课时，请先在课程结构中创建</option>}
                  {lessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      {lesson.label}
                    </option>
                  ))}
                </select>
              </label>
              )}
              <label className="text-xs font-semibold md:col-span-2">
                试卷说明
                <textarea
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  rows={2}
                  maxLength={5000}
                  className={`${fieldClass} leading-6`}
                />
              </label>
              <label className="text-xs font-semibold">
                建议用时（分钟）
                <input
                  value={draft.durationMinutes}
                  onChange={(event) => setDraft({ ...draft, durationMinutes: event.target.value })}
                  inputMode="numeric"
                  className={fieldClass}
                />
              </label>
              <label className="text-xs font-semibold">
                及格线（百分制）
                <input
                  value={draft.passingScore}
                  onChange={(event) => setDraft({ ...draft, passingScore: event.target.value })}
                  inputMode="decimal"
                  className={fieldClass}
                />
              </label>
              <label className="flex items-center gap-3 border-y py-3 text-xs font-semibold md:col-span-2">
                <input
                  name="allow_resubmission"
                  type="checkbox"
                  defaultChecked={edit ? edit.allowResubmission : paperType === "homework"}
                  className="h-4 w-4"
                />
                {paperType === "homework" ? "允许学生再次提交" : "允许考试重复提交（正式考试通常关闭）"}
              </label>
            </section>

            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">
                  题目（{draft.questions.length} 道，合计 {totalPoints} 分）
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(QUESTION_KIND_LABELS) as QuestionKind[]).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => addQuestion(kind)}
                      disabled={draft.questions.length >= MAX_QUESTIONS}
                      className="app-soft-card inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-40"
                    >
                      <Plus size={13} />
                      {QUESTION_KIND_LABELS[kind]}
                    </button>
                  ))}
                </div>
              </div>
              {draft.questions.length === 0 && (
                <p className="app-muted-text text-sm">还没有题目，请从上方添加。</p>
              )}
              {draft.questions.map((question, index) => (
                <MathQuestionEditor
                  key={index}
                  index={index}
                  total={draft.questions.length}
                  question={question}
                  onChange={(next) => updateQuestion(index, next)}
                  onRemove={() =>
                    setDraft((current) => ({
                      ...current,
                      questions: current.questions.filter((_, i) => i !== index),
                    }))
                  }
                  onMove={(direction) => moveQuestion(index, direction)}
                />
              ))}
            </section>

            {!validation.ok && (
              <div role="alert" className="rounded-xl border p-3 text-xs" style={{ borderColor: "var(--border)" }}>
                <p className="font-semibold">保存前需要修正：</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {validation.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            {state.status !== "idle" && (
              <p role="status" className="text-sm font-semibold">
                {state.message}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="submit"
                name="intent"
                value="draft"
                disabled={!canSubmit}
                className="app-soft-card inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
              >
                <Save size={15} />
                保存草稿
              </button>
              {canPublish && (
                <button
                  type="submit"
                  name="intent"
                  value="publish"
                  disabled={!canSubmit}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                  style={{ backgroundColor: "var(--primary)" }}
                >
                  <Send size={15} />
                  保存并发布
                </button>
              )}
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
