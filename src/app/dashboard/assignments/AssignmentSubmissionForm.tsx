"use client";

import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Languages,
  Mic2,
  PenLine,
  Save,
  Send,
  SpellCheck2,
} from "lucide-react";
import {
  type FormEvent,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { submitLearningAssignmentAction } from "./actions";
import { initialLearningAssignmentActionState } from "./action-state";
import { QUESTION_TYPE_LABELS, type QuestionType } from "./config";
import { AssignmentAudioRecorder } from "./AssignmentAudioRecorder";
import { AssignmentListeningPlayer } from "./AssignmentListeningPlayer";

export type AssignmentLanguageSkill =
  | "vocabulary"
  | "grammar"
  | "listening"
  | "speaking"
  | "reading"
  | "writing";

type Question = {
  id: string;
  type: QuestionType;
  languageSkill: AssignmentLanguageSkill | "";
  stimulusText: string;
  prompt: string;
  options: string[];
  points: number;
};

type DraftPayload = {
  answers: Record<string, string>;
  activeStep: number;
  savedAt: string;
};

const skillOrder: AssignmentLanguageSkill[] = [
  "vocabulary",
  "grammar",
  "listening",
  "speaking",
  "reading",
  "writing",
];

const skillMeta = {
  vocabulary: { label: "词汇", icon: Languages },
  grammar: { label: "语法", icon: SpellCheck2 },
  listening: { label: "听力", icon: Headphones },
  speaking: { label: "口语", icon: Mic2 },
  reading: { label: "阅读", icon: BookOpen },
  writing: { label: "写作", icon: PenLine },
} satisfies Record<
  AssignmentLanguageSkill,
  { label: string; icon: typeof Languages }
>;

function QuestionAnswer({
  assignmentId,
  question,
  previousAnswer,
  onAnswerChange,
}: {
  assignmentId: string;
  question: Question;
  previousAnswer?: string;
  onAnswerChange: () => void;
}) {
  if (question.type === "audio_recording") {
    return (
      <AssignmentAudioRecorder
        assignmentId={assignmentId}
        questionId={question.id}
        previousEvidenceId={previousAnswer}
        onEvidenceChange={onAnswerChange}
      />
    );
  }
  if (question.type === "single_choice") {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {question.options.map((option) => (
          <label
            key={option}
            className="app-soft-card flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm font-bold transition hover:border-[var(--primary)] has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--accent)]"
          >
            <input
              type="radio"
              name={`answer_${question.id}`}
              value={option}
              defaultChecked={previousAnswer === option}
            />
            {option}
          </label>
        ))}
      </div>
    );
  }
  if (question.type === "long_text") {
    return (
      <textarea
        name={`answer_${question.id}`}
        maxLength={10000}
        rows={7}
        defaultValue={previousAnswer ?? ""}
        placeholder="在这里填写完整答案"
        className="app-input w-full resize-y rounded-xl border px-4 py-3 text-base leading-7 sm:text-sm"
      />
    );
  }
  return (
    <input
      name={`answer_${question.id}`}
      maxLength={10000}
      type={question.type === "file_link" ? "url" : "text"}
      defaultValue={previousAnswer ?? ""}
      placeholder={question.type === "file_link" ? "粘贴完整文件链接" : "填写韩语答案"}
      className="app-input min-h-12 w-full rounded-xl border px-4 py-3 text-base sm:text-sm"
    />
  );
}

export function AssignmentSubmissionForm({
  assignmentId,
  studentId,
  questions,
  previousAnswers,
  cloudDraft,
}: {
  assignmentId: string;
  studentId: string;
  questions: Question[];
  previousAnswers: Record<string, string>;
  cloudDraft?: DraftPayload | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRequestRef = useRef(0);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const action = submitLearningAssignmentAction.bind(null, assignmentId);
  const [state, formAction, pending] = useActionState(
    action,
    initialLearningAssignmentActionState
  );
  const grouped = useMemo(
    () =>
      skillOrder
        .map((skill) => ({
          skill,
          questions: questions.filter(
            (question) => question.languageSkill === skill
          ),
        }))
        .filter((group) => group.questions.length > 0),
    [questions]
  );
  const ungrouped = useMemo(
    () => questions.filter((question) => !question.languageSkill),
    [questions]
  );
  const allGroups = useMemo(
    () => [
      ...grouped,
      ...(ungrouped.length
        ? [{ skill: null, questions: ungrouped }]
        : []),
    ],
    [grouped, ungrouped]
  );
  const [activeStep, setActiveStep] = useState(0);
  const [restoredAnswers, setRestoredAnswers] = useState<Record<string, string>>(
    {}
  );
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(
    new Set(
      Object.entries(previousAnswers)
        .filter(([, answer]) => answer.trim())
        .map(([questionId]) => questionId)
    )
  );
  const [draftStatus, setDraftStatus] = useState<
    "idle" | "saving" | "saved" | "local-only"
  >("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");
  const draftKey = `learning-assignment-draft:${studentId}:${assignmentId}`;

  const collectAnswers = useCallback(() => {
    const form = formRef.current;
    if (!form) return {};
    const data = new FormData(form);
    return Object.fromEntries(
      questions.map((question) => [
        question.id,
        String(data.get(`answer_${question.id}`) ?? "").trim(),
      ])
    );
  }, [questions]);

  const updateAnswered = useCallback((answers: Record<string, string>) => {
    setAnsweredIds(
      new Set(
        Object.entries(answers)
          .filter(([, answer]) => answer.length > 0)
          .map(([questionId]) => questionId)
      )
    );
  }, []);

  const saveDraft = useCallback((step = activeStep) => {
    const answers = collectAnswers();
    updateAnswered(answers);
    const now = new Date().toISOString();
    const payload: DraftPayload = { answers, activeStep: step, savedAt: now };
    const requestVersion = ++saveRequestRef.current;
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(payload));
      setSavedAt(now);
    } catch {
      // 云端保存仍可继续。
    }
    setDraftStatus("saving");
    void fetch(`/api/assignments/${assignmentId}/draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, activeStep: step }),
    })
      .then(async (response) => {
        const result = (await response.json()) as {
          savedAt?: string;
          message?: string;
        };
        if (!response.ok || !result.savedAt) throw new Error(result.message);
        if (saveRequestRef.current !== requestVersion) return;
        setSavedAt(result.savedAt);
        setDraftStatus("saved");
      })
      .catch(() => {
        if (saveRequestRef.current === requestVersion) {
          setDraftStatus("local-only");
        }
      });
  }, [activeStep, assignmentId, collectAnswers, draftKey, updateAnswered]);

  const scheduleDraftSave = useCallback(() => {
    setDraftStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveDraft, 450);
  }, [saveDraft]);

  const handleEvidenceChange = useCallback(() => {
    window.setTimeout(scheduleDraftSave, 0);
  }, [scheduleDraftSave]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    try {
      const stored = window.localStorage.getItem(draftKey);
      const localDraft = stored ? (JSON.parse(stored) as DraftPayload) : null;
      const draft = [cloudDraft ?? null, localDraft]
        .filter((item): item is DraftPayload => Boolean(item?.savedAt))
        .sort(
          (left, right) =>
            new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime()
        )[0];
      if (!draft) return;
      if (!draft.answers || typeof draft.answers !== "object") return;
      questions.forEach((question) => {
        const value = String(draft.answers[question.id] ?? "");
        if (!value) return;
        const fields = form.querySelectorAll<
          HTMLInputElement | HTMLTextAreaElement
        >(`[name="answer_${question.id}"]`);
        fields.forEach((field) => {
          if (field instanceof HTMLInputElement && field.type === "radio") {
            field.checked = field.value === value;
          } else {
            field.value = value;
          }
        });
      });
      queueMicrotask(() => {
        updateAnswered(draft.answers);
        setRestoredAnswers(draft.answers);
        setActiveStep(
          Math.min(
            Math.max(0, Number(draft.activeStep) || 0),
            allGroups.length - 1
          )
        );
        setSavedAt(draft.savedAt || null);
        setDraftStatus("saved");
      });
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, [allGroups.length, cloudDraft, draftKey, questions, updateAnswered]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (state.status === "success") {
      window.localStorage.removeItem(draftKey);
      queueMicrotask(() => {
        setDraftStatus("idle");
        setSavedAt(null);
      });
    }
    if (state.status === "error") {
      errorSummaryRef.current?.focus();
    }
  }, [draftKey, state.status]);

  const currentGroup = allGroups[activeStep];
  const completedCount = answeredIds.size;
  const progressPercent = questions.length
    ? Math.round((completedCount / questions.length) * 100)
    : 0;

  function goToStep(nextStep: number) {
    const boundedStep = Math.min(Math.max(0, nextStep), allGroups.length - 1);
    saveDraft(boundedStep);
    setLocalError("");
    setActiveStep(boundedStep);
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const answers = collectAnswers();
    updateAnswered(answers);
    const firstMissing = questions.find((question) => !answers[question.id]);
    if (!firstMissing) {
      try {
        window.localStorage.setItem(
          draftKey,
          JSON.stringify({
            answers,
            activeStep,
            savedAt: new Date().toISOString(),
          })
        );
      } catch {
        // 本机存储不可用时仍允许提交，服务端会继续完成最终校验。
      }
      return;
    }
    event.preventDefault();
    const missingStep = allGroups.findIndex((group) =>
      group.questions.some((question) => question.id === firstMissing.id)
    );
    setActiveStep(Math.max(0, missingStep));
    setLocalError("还有题目没有完成，已经为你定位到第一道未作答题。答案仍保存在本机。");
    window.requestAnimationFrame(() => {
      errorSummaryRef.current?.focus();
      document.getElementById(`assignment-question-${firstMissing.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }

  if (!currentGroup) return null;

  return (
    <form
      ref={formRef}
      action={formAction}
      onChange={scheduleDraftSave}
      onInput={scheduleDraftSave}
      onSubmit={handleSubmit}
      data-permission="learning_assignments"
      className="scroll-mt-4 space-y-5 pb-4"
    >
      <section className="app-card sticky top-3 z-30 overflow-hidden rounded-2xl border shadow-sm">
        <div className="h-1.5 bg-[var(--surface-soft)]">
          <div
            className="h-full bg-[var(--status-success)] transition-[width] duration-200 motion-reduce:transition-none"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex flex-col gap-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <strong>作答进度 {completedCount} / {questions.length}</strong>
            <span className="app-muted-text inline-flex items-center gap-1.5" aria-live="polite">
              <Save size={14} aria-hidden="true" />
              {draftStatus === "saving"
                ? "正在同步云端…"
                : draftStatus === "local-only"
                  ? "云端暂时不可用，已保存在本机"
                : savedAt
                  ? `云端已保存 ${new Date(savedAt).toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "输入后自动保存到本机"}
            </span>
          </div>
          <nav
            aria-label="作业六项步骤"
            className="grid grid-cols-3 gap-1 sm:grid-cols-6"
          >
            {allGroups.map((group, index) => {
              const meta = group.skill ? skillMeta[group.skill] : null;
              const Icon = meta?.icon ?? CheckCircle2;
              const answered = group.questions.filter((question) =>
                answeredIds.has(question.id)
              ).length;
              const complete = answered === group.questions.length;
              const active = index === activeStep;
              return (
                <button
                  key={group.skill ?? "other"}
                  type="button"
                  onClick={() => goToStep(index)}
                  aria-current={active ? "step" : undefined}
                  className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-bold transition-colors"
                  style={{
                    borderColor: active ? "var(--primary)" : "transparent",
                    color: complete
                      ? "var(--status-success)"
                      : active
                        ? "var(--primary)"
                        : "var(--foreground-muted)",
                    backgroundColor: active ? "var(--accent)" : "transparent",
                  }}
                >
                  {complete ? <Check size={15} aria-hidden="true" /> : <Icon size={15} aria-hidden="true" />}
                  <span>{meta?.label ?? "综合"}</span>
                  <span className="font-mono text-[10px] opacity-70">
                    {answered}/{group.questions.length}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      </section>

      {(localError || state.message) && (
        <div
          ref={errorSummaryRef}
          tabIndex={-1}
          role={localError || state.status === "error" ? "alert" : "status"}
          className="rounded-2xl px-4 py-3 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          style={{
            color:
              localError || state.status === "error"
                ? "var(--status-danger)"
                : "var(--status-success)",
            backgroundColor:
              localError || state.status === "error"
                ? "var(--status-danger-surface)"
                : "var(--status-success-surface)",
          }}
        >
          {localError || state.message}
        </div>
      )}

      {allGroups.map((group, groupIndex) => {
        const meta = group.skill ? skillMeta[group.skill] : null;
        const Icon = meta?.icon ?? CheckCircle2;
        const active = groupIndex === activeStep;
        return (
          <section
            key={group.skill ?? "other"}
            hidden={!active}
            aria-hidden={!active}
            className="space-y-3"
          >
            <header className="flex items-center gap-3 px-1 pt-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent)] text-[var(--primary)]">
                <Icon size={19} aria-hidden="true" />
              </span>
              <div>
                <p className="app-muted-text text-xs font-bold">
                  第 {groupIndex + 1} / {allGroups.length} 项
                </p>
                <h2 className="text-xl font-bold">{meta?.label ?? "综合练习"}</h2>
                <p className="app-muted-text mt-0.5 text-xs">
                  本项共 {group.questions.length} 题，答案会自动保存。
                </p>
              </div>
            </header>

            {group.questions.map((question, index) => (
              <article
                id={`assignment-question-${question.id}`}
                key={question.id}
                tabIndex={-1}
                className="app-card scroll-mt-28 rounded-3xl border p-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-xs font-bold text-[var(--primary)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="app-muted-text text-xs font-bold">
                        {QUESTION_TYPE_LABELS[question.type]}
                      </span>
                      <span className="rounded-full bg-[var(--support-surface)] px-2 py-0.5 text-xs font-bold text-[var(--support)]">
                        {question.points} 分
                      </span>
                    </div>
                    <h3 className="mt-2 whitespace-pre-wrap text-sm font-bold leading-7">
                      {question.prompt}
                    </h3>
                  </div>
                </div>
                {question.stimulusText &&
                  (question.languageSkill === "listening" ? (
                    <AssignmentListeningPlayer script={question.stimulusText} />
                  ) : (
                    <div className="app-soft-card mt-4 rounded-2xl border px-4 py-3">
                      <p className="text-xs font-bold text-[var(--support)]">作答材料</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-7">
                        {question.stimulusText}
                      </p>
                    </div>
                  ))}
                <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--border-subtle)" }}>
                  <QuestionAnswer
                    key={`${question.id}:${restoredAnswers[question.id] ?? previousAnswers[question.id] ?? ""}`}
                    assignmentId={assignmentId}
                    question={question}
                    previousAnswer={
                      restoredAnswers[question.id] ?? previousAnswers[question.id]
                    }
                    onAnswerChange={handleEvidenceChange}
                  />
                </div>
              </article>
            ))}
          </section>
        );
      })}

      <div className="app-card sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3 shadow-lg sm:px-4">
        <button
          type="button"
          onClick={() => goToStep(activeStep - 1)}
          disabled={activeStep === 0 || pending}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={17} aria-hidden="true" />上一项
        </button>
        <span className="app-muted-text text-xs font-bold">
          {activeStep + 1} / {allGroups.length}
        </span>
        {activeStep < allGroups.length - 1 ? (
          <button
            type="button"
            onClick={() => goToStep(activeStep + 1)}
            disabled={pending}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            下一项<ChevronRight size={17} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            <Send size={16} aria-hidden="true" />
            {pending ? "正在提交…" : "提交全部答案"}
          </button>
        )}
      </div>
    </form>
  );
}
