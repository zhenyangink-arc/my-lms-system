"use client";

import {
  BookOpen,
  ChevronDown,
  Headphones,
  Mic2,
  PenLine,
  Settings2,
  X,
} from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { initialLearningAssignmentActionState } from "@/app/dashboard/assignments/action-state";
import { saveChapterHomeworkPlanAction } from "./homework-plan-actions";

export type HomeworkLanguageSkill =
  | "listening"
  | "speaking"
  | "reading"
  | "writing";

export type HomeworkSkillSetting = {
  languageSkill: HomeworkLanguageSkill;
  enabled: boolean;
  responseMode: string;
  targetQuestionCount: number;
  targetPoints: number;
  durationMinutes: number;
  instructions: string;
};

export type HomeworkQuestionPreview = {
  id: string;
  languageSkill: HomeworkLanguageSkill;
  sourceBankVersion: number | null;
  questionType: string;
  stimulusText: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: string;
  sourceSkill: string;
  points: number;
  sortOrder: number;
};

export type ChapterHomeworkPlanValue = {
  id: string;
  title: string;
  durationMinutes: number;
  passingScore: number;
  allowResubmission: boolean;
  status: "draft" | "published" | "archived";
  settings: HomeworkSkillSetting[];
  questions: HomeworkQuestionPreview[];
};

const skillOrder: HomeworkLanguageSkill[] = [
  "listening",
  "speaking",
  "reading",
  "writing",
];

const skillLabels: Record<HomeworkLanguageSkill, string> = {
  listening: "听力",
  speaking: "口语",
  reading: "阅读",
  writing: "写作",
};

const responseModeLabels: Record<string, string> = {
  single_choice: "单项选择",
  short_text: "短文本",
  long_text: "长文本",
  audio_recording: "录音",
  mixed: "混合",
};

const questionTypeLabels: Record<string, string> = {
  single_choice: "选择题",
  short_text: "简答题",
  long_text: "写作题",
  audio_recording: "录音题",
};

const difficultyLabels: Record<string, string> = {
  foundation: "基础",
  medium: "中等",
  hard: "困难",
  expert: "极难",
};

function SkillIcon({
  skill,
  size = 16,
}: {
  skill: HomeworkLanguageSkill;
  size?: number;
}) {
  if (skill === "listening") return <Headphones size={size} />;
  if (skill === "speaking") return <Mic2 size={size} />;
  if (skill === "reading") return <BookOpen size={size} />;
  return <PenLine size={size} />;
}

function HomeworkQuestionRow({
  question,
  index,
}: {
  question: HomeworkQuestionPreview;
  index: number;
}) {
  return (
    <tr
      className="border-b align-top last:border-b-0"
      style={{ borderColor: "var(--app-border-soft)" }}
    >
      <td className="px-3 py-3 text-center font-mono text-[10px] font-black tabular-nums">
        {String(index + 1).padStart(2, "0")}
      </td>
      <td className="border-l px-3 py-3 text-[10px] leading-5">
        <p className="font-black">
          {questionTypeLabels[question.questionType] ?? question.questionType}
        </p>
        <p className="app-muted-text">
          {difficultyLabels[question.difficulty] ?? question.difficulty}
        </p>
        {question.sourceBankVersion && (
          <p className="font-black" style={{ color: "var(--app-success)" }}>
            平台题库 版本 {question.sourceBankVersion}
          </p>
        )}
      </td>
      <td className="border-l px-4 py-3">
        {question.stimulusText && (
          <div
            className="mb-2 border-l-2 pl-3"
            style={{
              borderColor: "var(--app-accent)",
            }}
          >
            <p className="text-[9px] font-black text-[var(--app-accent)]">
              听力材料 · 仅管理端预览
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs font-bold leading-5">
              {question.stimulusText}
            </p>
          </div>
        )}
        <p className="whitespace-pre-wrap text-xs font-bold leading-5">
          {question.prompt}
        </p>
      </td>
      <td className="border-l px-3 py-3 text-[11px] leading-5">
        {question.options.length > 0
          ? question.options.map((option, optionIndex) => (
              <p key={`${question.id}-${optionIndex}`}>
                <span className="mr-1 font-mono font-black">
                  {String.fromCharCode(65 + optionIndex)}.
                </span>
                {option}
              </p>
            ))
          : "—"}
      </td>
      <td
        className="border-l px-3 py-3 text-[11px] font-bold leading-5"
        style={{ color: "var(--app-success)" }}
      >
        {question.correctAnswer ||
          (question.questionType === "audio_recording"
            ? "教师按录音评分"
            : "教师按写作评分")}
      </td>
      <td className="app-muted-text border-l px-3 py-3 text-[10px] leading-5">
        {question.sourceSkill && <p>能力：{({ vocabulary: "词汇", grammar: "语法", listening: "听力", speaking: "口语", reading: "阅读", writing: "写作", communication: "交际" } as Record<string, string>)[question.sourceSkill] ?? "综合"}</p>}
        <p>{question.explanation || "—"}</p>
      </td>
      <td className="border-l px-3 py-3 text-center font-mono text-xs font-black tabular-nums">
        {question.points}
      </td>
    </tr>
  );
}

function HomeworkSkillSection({
  skill,
  setting,
  questions,
}: {
  skill: HomeworkLanguageSkill;
  setting: HomeworkSkillSetting | undefined;
  questions: HomeworkQuestionPreview[];
}) {
  const responseMode =
    setting?.responseMode ??
    (skill === "speaking"
      ? "audio_recording"
      : skill === "writing"
        ? "long_text"
        : "mixed");

  return (
    <details
      open
      className="group overflow-hidden border"
      style={{ borderColor: "var(--app-border)" }}
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-3 px-4 py-3"
        style={{ backgroundColor: "var(--app-soft-bg)" }}
      >
        <span className="text-[var(--app-accent)]">
          <SkillIcon skill={skill} />
        </span>
        <span className="text-sm font-black">{skillLabels[skill]}</span>
        <span className="app-muted-text text-[10px]">
          已配置 {questions.length} 题 · 目标{" "}
          {setting?.targetQuestionCount ?? 1} 题
        </span>
        <ChevronDown
          className="app-muted-text ml-auto transition-transform group-open:rotate-180"
          size={15}
        />
      </summary>

      <div className="border-t">
        <input type="hidden" name={`${skill}_enabled`} value="on" />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-40" />
              <col className="w-28" />
              <col className="w-28" />
              <col className="w-32" />
              <col />
            </colgroup>
            <thead>
              <tr
                className="border-b app-muted-text"
                style={{
                  borderColor: "var(--app-border-soft)",
                  backgroundColor: "var(--app-soft-bg)",
                }}
              >
                <th className="px-3 py-2 text-[10px] font-bold">作答方式</th>
                <th className="border-l px-3 py-2 text-[10px] font-bold">
                  目标题量
                </th>
                <th className="border-l px-3 py-2 text-[10px] font-bold">
                  目标分值
                </th>
                <th className="border-l px-3 py-2 text-[10px] font-bold">
                  时长（分钟）
                </th>
                <th className="border-l px-3 py-2 text-[10px] font-bold">
                  要求说明
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                className="border-b"
                style={{ borderColor: "var(--app-border)" }}
              >
                <td className="px-3 py-2.5">
                  <select
                    aria-label={`${skillLabels[skill]}作答方式`}
                    name={`${skill}_response_mode`}
                    defaultValue={responseMode}
                    className="app-input w-full rounded-md border px-2.5 py-2 text-xs"
                  >
                    {Object.entries(responseModeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border-l px-3 py-2.5">
                  <input
                    aria-label={`${skillLabels[skill]}目标题量`}
                    name={`${skill}_target_question_count`}
                    type="number"
                    min={0}
                    max={100}
                    required
                    defaultValue={setting?.targetQuestionCount ?? 1}
                    className="app-input w-full rounded-md border px-2.5 py-2 text-xs"
                  />
                </td>
                <td className="border-l px-3 py-2.5">
                  <input
                    aria-label={`${skillLabels[skill]}目标分值`}
                    name={`${skill}_target_points`}
                    type="number"
                    min={0}
                    max={1000}
                    step={0.01}
                    required
                    defaultValue={setting?.targetPoints ?? 25}
                    className="app-input w-full rounded-md border px-2.5 py-2 text-xs"
                  />
                </td>
                <td className="border-l px-3 py-2.5">
                  <input
                    aria-label={`${skillLabels[skill]}时长`}
                    name={`${skill}_duration_minutes`}
                    type="number"
                    min={1}
                    max={180}
                    required
                    defaultValue={setting?.durationMinutes ?? 5}
                    className="app-input w-full rounded-md border px-2.5 py-2 text-xs"
                  />
                </td>
                <td className="border-l px-3 py-2.5">
                  <textarea
                    aria-label={`${skillLabels[skill]}要求说明`}
                    name={`${skill}_instructions`}
                    maxLength={2000}
                    rows={2}
                    defaultValue={setting?.instructions ?? ""}
                    placeholder={`填写${skillLabels[skill]}要求`}
                    className="app-input w-full resize-y rounded-md border px-3 py-2 text-xs leading-5"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-14" />
              <col className="w-28" />
              <col className="w-[28%]" />
              <col className="w-[23%]" />
              <col className="w-[14%]" />
              <col />
              <col className="w-16" />
            </colgroup>
            <thead>
              <tr
                className="border-b app-muted-text"
                style={{
                  borderColor: "var(--app-border-soft)",
                  backgroundColor: "var(--app-soft-bg)",
                }}
              >
                <th className="px-3 py-2.5 text-center text-[10px] font-bold">
                  题号
                </th>
                <th className="border-l px-3 py-2.5 text-[10px] font-bold">
                  题型 / 来源
                </th>
                <th className="border-l px-4 py-2.5 text-[10px] font-bold">
                  材料 / 题目
                </th>
                <th className="border-l px-3 py-2.5 text-[10px] font-bold">
                  选项
                </th>
                <th className="border-l px-3 py-2.5 text-[10px] font-bold">
                  答案 / 评分
                </th>
                <th className="border-l px-3 py-2.5 text-[10px] font-bold">
                  解析
                </th>
                <th className="border-l px-3 py-2.5 text-center text-[10px] font-bold">
                  分值
                </th>
              </tr>
            </thead>
            <tbody>
              {questions.map((question, index) => (
                <HomeworkQuestionRow
                  key={question.id}
                  question={question}
                  index={index}
                />
              ))}
              {questions.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="app-muted-text px-4 py-8 text-center text-xs"
                  >
                    当前章节的{skillLabels[skill]}题目尚未生成。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

export function ChapterHomeworkPlanEditor({
  chapterTitle,
  plan,
}: {
  chapterTitle: string;
  plan: ChapterHomeworkPlanValue;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const action = saveChapterHomeworkPlanAction.bind(null, plan.id);
  const [state, formAction, pending] = useActionState(
    action,
    initialLearningAssignmentActionState
  );
  const settingsBySkill = new Map(
    plan.settings.map((setting) => [setting.languageSkill, setting])
  );
  const questionsBySkill = new Map<
    HomeworkLanguageSkill,
    HomeworkQuestionPreview[]
  >();
  skillOrder.forEach((skill) => questionsBySkill.set(skill, []));
  plan.questions.forEach((question) => {
    questionsBySkill.get(question.languageSkill)?.push(question);
  });
  questionsBySkill.forEach((questions) =>
    questions.sort((a, b) => a.sortOrder - b.sortOrder)
  );

  useEffect(() => {
    if (!isOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) setIsOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, pending]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-bold text-[var(--app-secondary)] hover:underline"
      >
        <Settings2 size={12} />
        配置作业
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-2 backdrop-blur-[2px] sm:p-5"
          role="presentation"
          onClick={() => {
            if (!pending) setIsOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`homework-plan-${plan.id}`}
            className="app-card flex h-[calc(100dvh-1rem)] w-full max-w-[1500px] flex-col overflow-hidden rounded-2xl border shadow-2xl sm:h-[calc(100dvh-2.5rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b px-5 py-4 sm:px-6">
              <div>
                <p className="app-muted-text text-[11px] font-bold">
                  {chapterTitle} · 共 {plan.questions.length} 题
                </p>
                <h2
                  id={`homework-plan-${plan.id}`}
                  className="mt-1 text-xl font-black"
                >
                  章节作业配置与题目预览
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={pending}
                aria-label="关闭章节作业配置"
                className="app-soft-card flex h-10 w-10 items-center justify-center rounded-xl border disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <form action={formAction} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3 sm:p-4">
                <div
                  className="overflow-x-auto border"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
                    <colgroup>
                      <col />
                      <col className="w-32" />
                      <col className="w-32" />
                      <col className="w-40" />
                      <col className="w-52" />
                    </colgroup>
                    <thead>
                      <tr
                        className="border-b app-muted-text"
                        style={{
                          borderColor: "var(--app-border-soft)",
                          backgroundColor: "var(--app-soft-bg)",
                        }}
                      >
                        <th className="px-3 py-2 text-[10px] font-bold">
                          章节标题
                        </th>
                        <th className="border-l px-3 py-2 text-[10px] font-bold">
                          总时长
                        </th>
                        <th className="border-l px-3 py-2 text-[10px] font-bold">
                          及格线
                        </th>
                        <th className="border-l px-3 py-2 text-[10px] font-bold">
                          状态
                        </th>
                        <th className="border-l px-3 py-2 text-[10px] font-bold">
                          再次提交
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-3 py-2.5">
                          <input
                            aria-label="章节标题"
                            name="title"
                            defaultValue={plan.title}
                            readOnly
                            className="app-input w-full cursor-default rounded-md border px-3 py-2.5 text-xs opacity-75"
                          />
                        </td>
                        <td className="border-l px-3 py-2.5">
                          <input
                            aria-label="总时长"
                            name="duration_minutes"
                            type="number"
                            min={1}
                            max={600}
                            required
                            defaultValue={plan.durationMinutes}
                            className="app-input w-full rounded-md border px-3 py-2.5 text-xs"
                          />
                        </td>
                        <td className="border-l px-3 py-2.5">
                          <input
                            aria-label="及格线"
                            name="passing_score"
                            type="number"
                            min={0}
                            max={100}
                            step={0.01}
                            required
                            defaultValue={plan.passingScore}
                            className="app-input w-full rounded-md border px-3 py-2.5 text-xs"
                          />
                        </td>
                        <td className="border-l px-3 py-2.5">
                          <select
                            aria-label="状态"
                            name="status"
                            defaultValue={plan.status}
                            className="app-input w-full rounded-md border px-3 py-2.5 text-xs"
                          >
                            <option value="draft">草稿</option>
                            <option value="published">已发布</option>
                            <option value="archived">已归档</option>
                          </select>
                        </td>
                        <td className="border-l px-3 py-2.5">
                          <label className="flex items-center gap-2 text-xs font-bold">
                            <input
                              name="allow_resubmission"
                              type="checkbox"
                              defaultChecked={plan.allowResubmission}
                            />
                            允许学生再次提交
                          </label>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {skillOrder.map((skill) => (
                  <HomeworkSkillSection
                    key={skill}
                    skill={skill}
                    setting={settingsBySkill.get(skill)}
                    questions={questionsBySkill.get(skill) ?? []}
                  />
                ))}
              </div>

              <div className="border-t px-5 py-3 sm:px-6">
                {state.message && (
                  <p
                    className="mb-2 text-xs font-bold"
                    style={{
                      color:
                        state.status === "error"
                          ? "#c94f45"
                          : "var(--app-success)",
                    }}
                  >
                    {state.message}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    disabled={pending}
                    className="app-soft-card rounded-lg border px-4 py-2.5 text-xs font-bold disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-lg px-5 py-2.5 text-xs font-black text-white disabled:opacity-50"
                    style={{ backgroundColor: "var(--app-secondary)" }}
                  >
                    {pending ? "正在保存…" : "保存章节作业"}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
