"use client";

import { CheckCircle2, Circle, CircleAlert } from "lucide-react";
import { useState } from "react";

import type { PublishedChapterPracticeBlock } from "../student/types";
import type { StudentChapterPracticeProgress } from "../student/types";
import { ListeningBlockContent } from "./listening-block-content";

type JsonRecord = Record<string, unknown>;

const FIELD_LABELS: Record<string, string> = {
  chapterDescription: "本章说明",
  learningObjectives: "学习目标",
  lessonTasks: "学习任务",
  keyPoints: "学习重点",
  textbookGoal: "教材目标",
  textbookScenario: "学习情境",
  commonMistakes: "易错提醒",
  summary: "本章小结",
  reflectionQuestions: "思考题",
  description: "内容说明",
  focus: "练习重点",
  helper: "学习提示",
  passageTitle: "阅读标题",
  passage: "阅读材料",
  koreanExample: "韩语示例",
  stimulus: "练习材料",
  durationMinutes: "建议用时",
  passingScore: "目标分数",
  testQuestionCount: "题量",
  questionCount: "题量",
};

const HIDDEN_FIELDS = new Set([
  "courseKey",
  "chapterSlug",
  "chapterTitle",
  "chapterKoreanTitle",
  "chapterNumber",
  "practiceMode",
  "catalogAligned",
  "speakBeforeAnswer",
  "audioStatus",
  "testSlug",
  "judgement",
  "configuredObjectiveQuestionCount",
  "objectiveQuestionCount",
]);

function objectValue(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function textValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  const record = objectValue(value);
  for (const key of ["zh-CN", "zh", "ko-KR", "ko", "text", "label"]) {
    if (typeof record[key] === "string" && record[key].trim()) {
      return record[key].trim();
    }
  }
  return "";
}

function displayScalar(key: string, value: unknown) {
  if (key === "durationMinutes" && Number.isFinite(Number(value))) {
    return `${Number(value)} 分钟`;
  }
  if (key === "passingScore" && Number.isFinite(Number(value))) {
    return `${Number(value)} 分`;
  }
  if (
    (key === "testQuestionCount" || key === "questionCount") &&
    Number.isFinite(Number(value))
  ) {
    return `${Number(value)} 题`;
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "是" : "否";
  return textValue(value);
}

function ContentValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const text = textValue(value);
  if (text) {
    return (
      <p className="whitespace-pre-line text-sm font-medium leading-7 text-[var(--foreground-secondary)]">
        {text}
      </p>
    );
  }

  if (Array.isArray(value)) {
    const items = value.filter((item) => textValue(item) || Object.keys(objectValue(item)).length);
    if (items.length === 0) return null;
    return (
      <ul className="grid gap-2" role="list">
        {items.map((item, index) => (
          <li
            key={index}
            className="rounded-xl bg-[var(--surface-soft)] px-3 py-2.5 text-sm leading-6"
          >
            <ContentValue value={item} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }

  const entries = Object.entries(objectValue(value)).filter(
    ([key, item]) => !HIDDEN_FIELDS.has(key) && item !== null && item !== "",
  );
  if (entries.length === 0 || depth > 4) return null;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {entries.map(([key, item]) => {
        const scalar = displayScalar(key, item);
        return (
          <div key={key} className="rounded-xl bg-[var(--surface-soft)] p-3">
            <p className="text-xs font-bold text-[var(--foreground)]">
              {FIELD_LABELS[key] ?? key}
            </p>
            <div className="mt-1.5">
              {scalar ? (
                <p className="whitespace-pre-line text-sm font-medium leading-6 text-[var(--foreground-secondary)]">
                  {scalar}
                </p>
              ) : (
                <ContentValue value={item} depth={depth + 1} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type PublishedQuestion = {
  id: string;
  type: string;
  prompt: string;
  content: JsonRecord;
  maxScore: number;
};

function parseQuestions(value: unknown): PublishedQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    const record = objectValue(item);
    const prompt = textValue(record.prompt);
    if (!prompt) return [];
    return [
      {
        id: textValue(record.id) || String(index),
        type: textValue(record.type),
        prompt,
        content: objectValue(record.content),
        maxScore: Number(record.maxScore) || 0,
      },
    ];
  });
}

function QuestionList({ questions }: { questions: PublishedQuestion[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  return (
    <div className="space-y-4">
      {questions.map((question, questionIndex) => {
        const options = Array.isArray(question.content.options)
          ? question.content.options.flatMap((item) => {
              const option = objectValue(item);
              const label = textValue(option.label);
              const value = textValue(option.value);
              return label && value ? [{ label, value }] : [];
            })
          : [];
        const inputId = `published-question-${question.id}`;
        return (
          <fieldset
            key={question.id}
            className="rounded-2xl border border-[var(--border-subtle)] p-4"
          >
            <legend className="px-1 text-sm font-bold leading-6">
              {questionIndex + 1}. {question.prompt}
            </legend>
            {textValue(question.content.hint) ? (
              <p className="mt-2 text-xs leading-5 text-[var(--foreground-secondary)]">
                提示：{textValue(question.content.hint)}
              </p>
            ) : null}
            {textValue(question.content.koreanExample) ? (
              <p className="mt-3 rounded-xl bg-[var(--surface-soft)] p-3 text-base font-bold" lang="ko">
                {textValue(question.content.koreanExample)}
              </p>
            ) : null}
            {textValue(question.content.stimulus) ? (
              <p className="mt-3 rounded-xl bg-[var(--surface-soft)] p-3 text-base font-bold" lang="ko">
                {textValue(question.content.stimulus)}
              </p>
            ) : null}
            {options.length > 0 ? (
              <div className="mt-3 grid gap-2">
                {options.map((option) => {
                  const selected = answers[question.id] === option.value;
                  return (
                    <label
                      key={option.value}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface-soft)]"
                      style={{
                        borderColor: selected ? "var(--primary)" : "var(--border)",
                        backgroundColor: selected ? "var(--accent)" : "var(--card)",
                      }}
                    >
                      <input
                        type="radio"
                        name={inputId}
                        value={option.value}
                        checked={selected}
                        onChange={() =>
                          setAnswers((current) => ({
                            ...current,
                            [question.id]: option.value,
                          }))
                        }
                        className="h-4 w-4 accent-[var(--primary)]"
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <label className="mt-3 block text-xs font-bold" htmlFor={inputId}>
                你的回答
                <textarea
                  id={inputId}
                  value={answers[question.id] ?? ""}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      [question.id]: event.target.value,
                    }))
                  }
                  rows={3}
                  className="mt-2 min-h-24 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-base font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                />
              </label>
            )}
          </fieldset>
        );
      })}
      <p className="flex items-start gap-2 rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-xs leading-5 text-[var(--foreground-secondary)]">
        <CircleAlert className="mt-0.5 shrink-0" size={14} aria-hidden="true" />
        此处用于按本章材料回忆和作答；需要正确率核验时，请在自我检测后进入章节测试。
      </p>
    </div>
  );
}

function NodeList({ value }: { value: unknown }) {
  if (!Array.isArray(value)) return null;
  const nodes = value.flatMap((item) => {
    const node = objectValue(item);
    const title = textValue(node.title);
    if (!title && !Object.keys(objectValue(node.content)).length) return [];
    return [{ title, content: node.content }];
  });
  if (nodes.length === 0) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {nodes.map((node, index) => (
        <article key={`${node.title}-${index}`} className="rounded-2xl bg-[var(--surface-soft)] p-4">
          {node.title ? <h3 className="text-sm font-bold">{node.title}</h3> : null}
          <div className={node.title ? "mt-2" : ""}>
            <ContentValue value={node.content} />
          </div>
        </article>
      ))}
    </div>
  );
}

export function PublishedBlockContent({
  block,
  onListeningPlay,
  onListeningProgress,
}: {
  block: PublishedChapterPracticeBlock;
  onListeningPlay?: () => void;
  onListeningProgress?: (progress: StudentChapterPracticeProgress) => void;
}) {
  if (block.blockType === "listening") {
    return (
      <ListeningBlockContent
        block={block}
        onPlay={onListeningPlay}
        onProgress={onListeningProgress}
      />
    );
  }

  const payload = block.contentPayload;
  const questions = parseQuestions(payload.questions);
  const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  const exercise = objectValue(payload.exercise);

  const primaryEntries = Object.entries(payload).filter(
    ([key, value]) =>
      !["questions", "nodes", "exercise", "skills", "config", "instruction", "prompt"].includes(key) &&
      !HIDDEN_FIELDS.has(key) &&
      value !== null &&
      value !== "",
  );
  const exerciseEntries = Object.entries(exercise).filter(
    ([key, value]) =>
      ["focus", "helper", "passageTitle", "passage", "description"].includes(key) &&
      value !== null &&
      value !== "",
  );

  const hasVisibleContent =
    nodes.length > 0 ||
    questions.length > 0 ||
    primaryEntries.length > 0 ||
    exerciseEntries.length > 0;

  if (!hasVisibleContent) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-sm font-medium">
        <Circle aria-hidden="true" size={14} />
        按上方说明完成本块练习。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {block.blockType === "listening" && typeof payload.audioStatus === "string" ? (
        <p className="flex items-center gap-2 rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-xs font-bold text-[var(--foreground-secondary)]">
          <CircleAlert size={14} aria-hidden="true" />
          {payload.audioStatus === "ready"
            ? "听力材料已就绪；本页先展示已发布的文字内容。"
            : payload.audioStatus === "pending"
              ? "正式音频仍在准备，本页先展示已发布的文字内容。"
              : "本块暂未提供可用音频，本页仅展示已发布的文字内容。"}
        </p>
      ) : null}
      <NodeList value={nodes} />
      {primaryEntries.length > 0 ? (
        <ContentValue value={Object.fromEntries(primaryEntries)} />
      ) : null}
      {exerciseEntries.length > 0 ? (
        <ContentValue value={Object.fromEntries(exerciseEntries)} />
      ) : null}
      {questions.length > 0 ? <QuestionList questions={questions} /> : null}
      {questions.length === 0 && hasVisibleContent ? (
        <p className="flex items-center gap-2 text-xs font-medium text-[var(--foreground-secondary)]">
          <CheckCircle2 size={14} aria-hidden="true" />
          内容来自本章已发布巩固版本。
        </p>
      ) : null}
    </div>
  );
}
