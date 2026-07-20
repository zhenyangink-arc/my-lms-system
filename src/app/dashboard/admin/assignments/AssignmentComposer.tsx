"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { ClipboardPlus, Plus, Save, Send, Trash2, UsersRound } from "lucide-react";

import { createLearningAssignmentAction } from "@/app/dashboard/assignments/actions";
import { initialLearningAssignmentActionState } from "@/app/dashboard/assignments/action-state";
import { ASSIGNMENT_TYPE_LABELS, QUESTION_TYPE_LABELS, type AssignmentType, type QuestionType } from "@/app/dashboard/assignments/config";

type QuestionDraft = {
  id: number;
  type: QuestionType;
  prompt: string;
  points: string;
  optionsText: string;
  correctAnswer: string;
  explanation: string;
};

type StudentOption = { id: string; name: string; email: string; tier: string };
type CourseOption = { id: string; title: string };

function newQuestion(id: number): QuestionDraft {
  return { id, type: "short_text", prompt: "", points: "10", optionsText: "", correctAnswer: "", explanation: "" };
}

export function AssignmentComposer({ courses, students }: { courses: CourseOption[]; students: StudentOption[] }) {
  const [state, formAction, pending] = useActionState(createLearningAssignmentAction, initialLearningAssignmentActionState);
  const [assignmentType, setAssignmentType] = useState<AssignmentType>("homework");
  const [targetScope, setTargetScope] = useState("all_students");
  const [questions, setQuestions] = useState<QuestionDraft[]>([newQuestion(1)]);
  const nextQuestionId = useRef(2);

  const questionsJson = useMemo(
    () => JSON.stringify(questions.map((question) => ({
      type: question.type,
      prompt: question.prompt,
      points: Number(question.points),
      options: question.optionsText.split("\n").map((option) => option.trim()).filter(Boolean),
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
    }))),
    [questions]
  );
  const totalPoints = questions.reduce((total, question) => total + (Number(question.points) || 0), 0);

  function updateQuestion(id: number, patch: Partial<QuestionDraft>) {
    setQuestions((current) => current.map((question) => question.id === id ? { ...question, ...patch } : question));
  }

  return (
    <section id="create-assignment" className="app-card scroll-mt-24 rounded-3xl border p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>
          <ClipboardPlus size={22} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-black">布置新任务</h2>
          <p className="app-muted-text mt-1 text-xs leading-5">一次设置题目、分值、学生范围和截止时间。</p>
        </div>
      </div>

      <form action={formAction} className="mt-6 space-y-5">
        <input type="hidden" name="questions_json" value={questionsJson} />

        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-xs font-black">任务类型
            <select name="assignment_type" value={assignmentType} onChange={(event) => setAssignmentType(event.target.value as AssignmentType)} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm">
              {Object.entries(ASSIGNMENT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs font-black">关联课程
            <select name="course_id" defaultValue="" className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm">
              <option value="">不关联具体课程</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </select>
          </label>
          <label className="text-xs font-black">建议用时（分钟）
            <input name="duration_minutes" type="number" min={1} max={600} defaultValue={assignmentType === "exam" ? 60 : 30} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm" />
          </label>
        </div>

        <label className="block text-xs font-black">标题
          <input name="title" required minLength={2} maxLength={120} placeholder="例如：韩语初级第二单元课后作业" className="app-input mt-2 w-full rounded-xl border px-4 py-3 text-sm" />
        </label>
        <label className="block text-xs font-black">任务说明
          <textarea name="description" maxLength={5000} rows={4} placeholder="说明完成要求、注意事项和评分标准。" className="app-input mt-2 w-full resize-y rounded-xl border px-4 py-3 text-sm leading-6" />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs font-black">截止时间（韩国时间）
            <input name="due_at" type="datetime-local" required className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm" />
          </label>
          <label className="text-xs font-black">分配范围
            <select name="target_scope" value={targetScope} onChange={(event) => setTargetScope(event.target.value)} className="app-input mt-2 w-full rounded-xl border px-3 py-3 text-sm">
              <option value="all_students">全部在籍学生</option>
              <option value="selected_students">指定学生</option>
            </select>
          </label>
        </div>

        {targetScope === "selected_students" && (
          <fieldset className="app-soft-card rounded-2xl border p-4">
            <legend className="px-2 text-xs font-black">选择学生</legend>
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {students.map((student) => (
                <label key={student.id} className="app-card flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5">
                  <input type="checkbox" name="target_ids" value={student.id} className="h-4 w-4" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs font-black">{student.name}</span><span className="app-muted-text block truncate text-xs">{student.email}</span></span>
                  <span className="app-muted-text text-xs font-bold">{student.tier}</span>
                </label>
              ))}
              {students.length === 0 && <p className="p-4 text-center text-xs app-muted-text">暂无可分配的学生账号。</p>}
            </div>
          </fieldset>
        )}

        <div className="flex items-center justify-between gap-3 border-t pt-5" style={{ borderColor: "var(--app-border-soft)" }}>
          <div><h3 className="font-black">题目设置</h3><p className="app-muted-text mt-1 text-xs">{questions.length} 题 · 共 {totalPoints} 分</p></div>
          <button type="button" onClick={() => setQuestions((current) => [...current, newQuestion(nextQuestionId.current++)])} className="app-soft-card inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black">
            <Plus size={14} aria-hidden="true" /> 添加题目
          </button>
        </div>

        <div className="space-y-4">
          {questions.map((question, index) => (
            <article key={question.id} className="app-soft-card rounded-2xl border p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>{index + 1}</span>
                <select value={question.type} onChange={(event) => updateQuestion(question.id, { type: event.target.value as QuestionType })} className="app-input min-w-0 flex-1 rounded-xl border px-3 py-2 text-xs font-bold">
                  {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <label className="flex items-center gap-2 text-xs font-black">分值
                  <input value={question.points} onChange={(event) => updateQuestion(question.id, { points: event.target.value })} type="number" min="0.5" max="1000" step="0.5" className="app-input w-20 rounded-xl border px-2 py-2 text-center" />
                </label>
                <button type="button" disabled={questions.length === 1} onClick={() => setQuestions((current) => current.filter((item) => item.id !== question.id))} className="rounded-xl p-2 disabled:opacity-30" style={{ color: "#c94f45", backgroundColor: "#fff0ed" }} aria-label={`删除第 ${index + 1} 题`}><Trash2 size={15} /></button>
              </div>
              <textarea value={question.prompt} onChange={(event) => updateQuestion(question.id, { prompt: event.target.value })} rows={3} maxLength={3000} placeholder="输入题目或作答要求" className="app-input mt-3 w-full resize-y rounded-xl border px-3 py-3 text-sm leading-6" />
              {question.type === "single_choice" && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="text-xs font-black">选项（每行一个）
                    <textarea value={question.optionsText} onChange={(event) => updateQuestion(question.id, { optionsText: event.target.value })} rows={4} placeholder={'选项一\n选项二\n选项三'} className="app-input mt-1.5 w-full rounded-xl border px-3 py-2 text-xs leading-5" />
                  </label>
                  <label className="text-xs font-black">参考答案
                    <input value={question.correctAnswer} onChange={(event) => updateQuestion(question.id, { correctAnswer: event.target.value })} placeholder="填写与某个选项完全一致的内容" className="app-input mt-1.5 w-full rounded-xl border px-3 py-2.5 text-xs" />
                  </label>
                </div>
              )}
              <label className="mt-3 block text-xs font-black">参考解析（仅管理端可见）
                <textarea value={question.explanation} onChange={(event) => updateQuestion(question.id, { explanation: event.target.value })} rows={2} maxLength={3000} placeholder="可选，填写批改参考或知识点解析" className="app-input mt-1.5 w-full rounded-xl border px-3 py-2 text-xs leading-5" />
              </label>
            </article>
          ))}
        </div>

        <label className="app-soft-card flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-xs font-bold">
          <input type="checkbox" name="allow_resubmission" defaultChecked className="h-4 w-4" /> 允许学生在截止前再次提交
          <UsersRound className="ml-auto app-muted-text" size={16} aria-hidden="true" />
        </label>

        {state.message && <p aria-live="polite" className="rounded-xl px-4 py-3 text-xs font-bold" style={{ color: state.status === "error" ? "#c94f45" : "var(--app-success)", backgroundColor: state.status === "error" ? "#fff0ed" : "var(--app-success-soft)" }}>{state.message}</p>}

        <div className="flex flex-wrap gap-2">
          <button type="submit" name="intent" value="publish" disabled={pending} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black text-white disabled:opacity-50" style={{ backgroundColor: "var(--app-accent)" }}><Send size={15} />{pending ? "正在保存…" : "保存并发布"}</button>
          <button type="submit" name="intent" value="draft" disabled={pending} className="app-soft-card inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-black disabled:opacity-50"><Save size={15} />保存草稿</button>
        </div>
      </form>
    </section>
  );
}
