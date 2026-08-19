"use client";

import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Flag,
  Headphones,
  Languages,
  Mic2,
  PenLine,
  Save,
  Send,
  ShieldCheck,
  SpellCheck2,
  Timer,
  WifiOff,
} from "lucide-react";
import {
  type FormEvent,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { submitLearningAssignmentAction } from "./actions";
import { initialLearningAssignmentActionState } from "./action-state";
import {
  QUESTION_TYPE_LABELS,
  SUBMISSION_WORKFLOW_STATE_LABELS,
  type QuestionType,
  type SubmissionWorkflowState,
} from "./config";
import {
  formatExamRemainingTime,
  getExamQuestionStatus,
  getExamRemainingSeconds,
  getSubmissionConfirmationStage,
} from "./assignment-exam-ui";
import { AssignmentAudioRecorder } from "./AssignmentAudioRecorder";
import { AssignmentListeningPlayer } from "./AssignmentListeningPlayer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CardTitleWithHint } from "@/components/ui/card-title-with-hint";
import { LocalDateTime } from "@/components/LocalDateTime";

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
  reviewQuestionIds?: string[];
};

export type AssignmentExamConfig = {
  name: string;
  startsAt: string;
  dueAt: string | null;
  totalPoints: number;
  passingScore: number | null;
  maxAttempts: number;
  attemptsUsed: number;
  durationMinutes: number;
  startedAt: string | null;
  expiresAt: string | null;
  serverNow: string | null;
};

type ConfirmationStage = "unanswered" | "final" | null;

const examDateOptions: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

function subscribeToOnlineStatus(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineStatus() {
  return navigator.onLine;
}

function getServerOnlineStatus() {
  return true;
}

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
  submissionRequestId,
  questions,
  previousAnswers,
  cloudDraft,
  examConfig,
}: {
  assignmentId: string;
  studentId: string;
  submissionRequestId: string;
  questions: Question[];
  previousAnswers: Record<string, string>;
  cloudDraft?: DraftPayload | null;
  examConfig?: AssignmentExamConfig;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRequestRef = useRef(0);
  const confirmedSubmissionRef = useRef(false);
  const automaticSubmissionRef = useRef(false);
  const submissionIntentInputRef = useRef<HTMLInputElement>(null);
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
  const [reviewQuestionIds, setReviewQuestionIds] = useState<Set<string>>(
    new Set(),
  );
  const [draftStatus, setDraftStatus] = useState<
    "idle" | "saving" | "saved" | "local-only"
  >("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");
  const [confirmationStage, setConfirmationStage] =
    useState<ConfirmationStage>(null);
  const [unansweredCount, setUnansweredCount] = useState(0);
  const isOnline = useSyncExternalStore(
    subscribeToOnlineStatus,
    getOnlineStatus,
    getServerOnlineStatus,
  );
  const [examStarted, setExamStarted] = useState(!examConfig);
  const [examStartedAt, setExamStartedAt] = useState<string | null>(
    examConfig?.startedAt ?? null,
  );
  const [examExpiresAt, setExamExpiresAt] = useState<string | null>(
    examConfig?.expiresAt ?? null,
  );
  const [serverTimeOffsetMs, setServerTimeOffsetMs] = useState(() =>
    examConfig?.serverNow
      ? new Date(examConfig.serverNow).getTime() - Date.now()
      : 0,
  );
  const [startPending, setStartPending] = useState(false);
  const [startError, setStartError] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
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

  const saveDraft = useCallback((
    step = activeStep,
    reviewIds = reviewQuestionIds,
  ) => {
    const answers = collectAnswers();
    updateAnswered(answers);
    const now = new Date().toISOString();
    const payload: DraftPayload = {
      answers,
      activeStep: step,
      savedAt: now,
      reviewQuestionIds: [...reviewIds],
    };
    const requestVersion = ++saveRequestRef.current;
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(payload));
      setSavedAt(now);
    } catch {
      // 云端保存仍可继续。
    }
    if (!navigator.onLine) {
      setDraftStatus("local-only");
      return;
    }
    setDraftStatus("saving");
    void fetch(`/api/assignments/${assignmentId}/draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers,
        activeStep: step,
        requestId: submissionRequestId,
      }),
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
  }, [activeStep, assignmentId, collectAnswers, draftKey, reviewQuestionIds, submissionRequestId, updateAnswered]);

  const scheduleDraftSave = useCallback(() => {
    updateAnswered(collectAnswers());
    setDraftStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveDraft, 450);
  }, [collectAnswers, saveDraft, updateAnswered]);

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
        setReviewQuestionIds(new Set(draft.reviewQuestionIds ?? []));
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
  }, [allGroups.length, cloudDraft, draftKey, examStarted, questions, updateAnswered]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    []
  );

  useEffect(() => {
    const handleOffline = () => {
      setDraftStatus("local-only");
      saveDraft();
    };
    const handleOnline = () => {
      setDraftStatus("saving");
      saveDraft();
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [saveDraft]);

  useEffect(() => {
    if (!examConfig || !examStarted || !examStartedAt) return;
    const updateRemaining = () => {
      setRemainingSeconds(
        getExamRemainingSeconds({
          startedAt: examStartedAt,
          durationMinutes: examConfig.durationMinutes,
          now: Date.now() + serverTimeOffsetMs,
          dueAt: examConfig.dueAt,
          expiresAt: examExpiresAt,
        }),
      );
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1_000);
    return () => window.clearInterval(timer);
  }, [examConfig, examExpiresAt, examStarted, examStartedAt, serverTimeOffsetMs]);

  useEffect(() => {
    if (
      !examConfig ||
      !examStarted ||
      remainingSeconds !== 0 ||
      automaticSubmissionRef.current ||
      state.status === "success"
    ) return;
    automaticSubmissionRef.current = true;
    if (submissionIntentInputRef.current) {
      submissionIntentInputRef.current.value = "time_expired";
    }
    setLocalError("考试时间已结束，系统正在自动提交当前答案。");
    saveDraft();
    window.requestAnimationFrame(() => formRef.current?.requestSubmit());
  }, [examConfig, examStarted, remainingSeconds, saveDraft, state.status]);

  useEffect(() => {
    if (state.status === "success") {
      window.localStorage.removeItem(draftKey);
      queueMicrotask(() => {
        setDraftStatus("idle");
        setSavedAt(null);
      });
    }
    if (state.status === "error") {
      queueMicrotask(() => setLocalError(""));
      errorSummaryRef.current?.focus();
    }
  }, [draftKey, state.status]);

  const currentGroup = allGroups[activeStep];
  const completedCount = answeredIds.size;
  const progressPercent = questions.length
    ? Math.round((completedCount / questions.length) * 100)
    : 0;
  const questionLocations = useMemo(
    () =>
      questions.map((question, questionIndex) => ({
        question,
        questionIndex,
        groupIndex: allGroups.findIndex((group) =>
          group.questions.some((item) => item.id === question.id),
        ),
      })),
    [allGroups, questions],
  );
  const questionNumberById = useMemo(
    () => new Map(questions.map((question, index) => [question.id, index + 1])),
    [questions],
  );

  function goToStep(nextStep: number) {
    const boundedStep = Math.min(Math.max(0, nextStep), allGroups.length - 1);
    saveDraft(boundedStep);
    setLocalError("");
    setActiveStep(boundedStep);
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function goToQuestion(questionId: string) {
    const location = questionLocations.find(
      (item) => item.question.id === questionId,
    );
    if (!location) return;
    saveDraft(location.groupIndex);
    setLocalError("");
    setActiveStep(location.groupIndex);
    window.setTimeout(() => {
      const questionElement = document.getElementById(
        `assignment-question-${questionId}`,
      );
      questionElement?.scrollIntoView({ behavior: "smooth", block: "center" });
      questionElement?.focus({ preventScroll: true });
    }, 0);
  }

  function toggleReview(questionId: string) {
    const next = new Set(reviewQuestionIds);
    if (next.has(questionId)) next.delete(questionId);
    else next.add(questionId);
    setReviewQuestionIds(next);
    window.setTimeout(() => saveDraft(activeStep, next), 0);
  }

  async function startExam() {
    if (!examConfig) return;
    setStartPending(true);
    setStartError("");
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/start`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        startedAt?: unknown;
        expiresAt?: unknown;
        serverNow?: unknown;
        message?: unknown;
      };
      if (
        !response.ok ||
        typeof payload.startedAt !== "string" ||
        typeof payload.expiresAt !== "string" ||
        typeof payload.serverNow !== "string"
      ) {
        throw new Error(
          typeof payload.message === "string"
            ? payload.message
            : "考试暂时无法开始，请稍后重试。",
        );
      }
      setExamStartedAt(payload.startedAt);
      setExamExpiresAt(payload.expiresAt);
      setServerTimeOffsetMs(new Date(payload.serverNow).getTime() - Date.now());
      setExamStarted(true);
    } catch (error) {
      setStartError(
        error instanceof Error ? error.message : "考试暂时无法开始，请稍后重试。",
      );
    } finally {
      setStartPending(false);
    }
  }

  function submitAfterConfirmation() {
    confirmedSubmissionRef.current = true;
    if (submissionIntentInputRef.current) {
      submissionIntentInputRef.current.value =
        unansweredCount > 0 ? "confirmed_incomplete" : "complete";
    }
    setConfirmationStage(null);
    window.requestAnimationFrame(() => formRef.current?.requestSubmit());
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const answers = collectAnswers();
    updateAnswered(answers);
    if (confirmedSubmissionRef.current || automaticSubmissionRef.current) {
      confirmedSubmissionRef.current = false;
      try {
        window.localStorage.setItem(
          draftKey,
          JSON.stringify({
            answers,
            activeStep,
            savedAt: new Date().toISOString(),
            reviewQuestionIds: [...reviewQuestionIds],
          })
        );
      } catch {
        // 本机存储不可用时仍允许提交，服务端会继续完成最终校验。
      }
      return;
    }
    event.preventDefault();
    const missingCount = questions.filter((question) => !answers[question.id]).length;
    setUnansweredCount(missingCount);
    setConfirmationStage(getSubmissionConfirmationStage(missingCount));
  }

  if (!currentGroup) return null;

  if (examConfig && !examStarted) {
    return (
      <section className="app-card rounded-3xl border p-5 sm:p-6">
        <CardTitleWithHint
          headingLevel={2}
          title="考试说明"
          titleClassName="text-xl font-bold"
          description="点击开始后立即计时。退出或刷新页面不会重置剩余时间，考试时间结束后系统会自动尝试提交当前答案。"
        />
        <h3 className="mt-5 text-lg font-bold">{examConfig.name}</h3>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["开始时间", <LocalDateTime key="start" value={examConfig.startsAt} options={examDateOptions} />],
            ["截止时间", <LocalDateTime key="due" value={examConfig.dueAt} options={examDateOptions} fallback="未设置" />],
            ["总分", `${examConfig.totalPoints} 分`],
            ["及格分", examConfig.passingScore == null ? "未设置" : `${examConfig.passingScore} 分`],
            ["允许作答次数", `${examConfig.maxAttempts} 次`],
            ["已用次数", `${examConfig.attemptsUsed} 次`],
            ["考试时长", `${examConfig.durationMinutes} 分钟`],
          ].map(([label, value]) => (
            <div key={String(label)} className="app-soft-card rounded-2xl border p-4">
              <dt className="app-muted-text text-xs font-bold">{label}</dt>
              <dd className="mt-1 text-sm font-bold">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-[var(--status-warning-surface)] p-4 text-sm sm:flex-row sm:items-center">
          <CircleAlert className="shrink-0 text-[var(--status-warning)]" size={20} aria-hidden="true" />
          <p className="min-w-0 flex-1 leading-6">请确认网络稳定，并预留完整考试时间。作答会自动保存，但正式提交后不能撤回。</p>
          <button
            type="button"
            onClick={() => void startExam()}
            disabled={startPending}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <ShieldCheck size={17} aria-hidden="true" />
            {startPending ? "正在确认开考…" : examStartedAt ? "继续考试" : "开始考试"}
          </button>
        </div>
        {startError && (
          <p role="alert" className="mt-3 text-sm font-bold text-[var(--status-danger)]">
            {startError}
          </p>
        )}
      </section>
    );
  }

  if (state.status === "success" && state.submissionState && state.submittedAt) {
    const workflowState = state.submissionState as SubmissionWorkflowState;
    return (
      <section
        role="status"
        className="app-card rounded-3xl border p-6 text-center"
        style={{ backgroundColor: "var(--status-success-surface)" }}
      >
        <CheckCircle2
          className="mx-auto text-[var(--status-success)]"
          size={34}
          aria-hidden="true"
        />
        <h2 className="mt-3 text-xl font-bold">提交成功</h2>
        <dl className="mx-auto mt-5 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
          <div className="app-card rounded-2xl border p-4">
            <dt className="app-muted-text text-xs font-bold">提交时间</dt>
            <dd className="mt-1 text-sm font-bold">
              <LocalDateTime value={state.submittedAt} options={examDateOptions} />
            </dd>
          </div>
          <div className="app-card rounded-2xl border p-4">
            <dt className="app-muted-text text-xs font-bold">当前状态</dt>
            <dd className="mt-1 text-sm font-bold text-[var(--status-success)]">
              {SUBMISSION_WORKFLOW_STATE_LABELS[workflowState] ?? state.message}
            </dd>
          </div>
          <div className="app-card rounded-2xl border p-4">
            <dt className="app-muted-text text-xs font-bold">作答次数</dt>
            <dd className="mt-1 text-sm font-bold">
              第 {state.attemptNumber ?? "—"} 次
            </dd>
          </div>
        </dl>
      </section>
    );
  }

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
      <input
        type="hidden"
        name="submission_request_id"
        value={submissionRequestId}
      />
      <input
        ref={submissionIntentInputRef}
        type="hidden"
        name="submission_intent"
        defaultValue="complete"
      />
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-3 rounded-2xl bg-[var(--status-warning-surface)] px-4 py-3 text-sm font-bold text-[var(--status-warning)]"
        >
          <WifiOff className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
          <span>网络异常，答案已保存至本机，恢复网络后将自动同步。</span>
        </div>
      )}
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
            {examConfig && remainingSeconds !== null && (
              <strong
                className="inline-flex items-center gap-1.5 font-mono text-sm tabular-nums"
                style={{
                  color:
                    remainingSeconds <= 300
                      ? "var(--status-danger)"
                      : "var(--foreground)",
                }}
                aria-live={remainingSeconds <= 60 ? "assertive" : "off"}
                aria-label={`考试剩余时间 ${formatExamRemainingTime(remainingSeconds)}`}
              >
                <Timer size={16} aria-hidden="true" />
                {formatExamRemainingTime(remainingSeconds)}
              </strong>
            )}
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
          <div className="border-t pt-3" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <strong className="text-xs">题目导航</strong>
              <span className="app-muted-text text-xs">已答 {completedCount} · 未答 {questions.length - completedCount} · 待检查 {reviewQuestionIds.size}</span>
            </div>
            <nav aria-label="题目导航" className="flex flex-wrap gap-2">
              {questionLocations.map(({ question, questionIndex, groupIndex }) => {
                const status = getExamQuestionStatus(
                  answeredIds.has(question.id) ? "answered" : "",
                  reviewQuestionIds.has(question.id),
                );
                const active = groupIndex === activeStep;
                const statusLabel = status === "review" ? "待检查" : status === "answered" ? "已答" : "未答";
                return (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => goToQuestion(question.id)}
                    aria-label={`第 ${questionIndex + 1} 题，${statusLabel}`}
                    aria-current={active ? "location" : undefined}
                    className="inline-flex min-h-10 min-w-10 items-center justify-center gap-1 rounded-xl border px-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                    style={{
                      color: status === "review" ? "var(--status-warning)" : status === "answered" ? "var(--status-success)" : "var(--foreground-muted)",
                      backgroundColor: status === "review" ? "var(--status-warning-surface)" : status === "answered" ? "var(--status-success-surface)" : "var(--card)",
                      borderColor: active ? "var(--primary)" : "var(--border-subtle)",
                    }}
                  >
                    {status === "review" && <Flag size={12} aria-hidden="true" />}
                    {questionIndex + 1}
                  </button>
                );
              })}
            </nav>
          </div>
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
                    {questionNumberById.get(question.id) ?? index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="app-muted-text text-xs font-bold">
                        {QUESTION_TYPE_LABELS[question.type]}
                      </span>
                      <span className="rounded-full bg-[var(--support-surface)] px-2 py-0.5 text-xs font-bold text-[var(--support)]">
                        {question.points} 分
                      </span>
                      <button
                        type="button"
                        aria-pressed={reviewQuestionIds.has(question.id)}
                        onClick={() => toggleReview(question.id)}
                        className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                        style={{
                          color: reviewQuestionIds.has(question.id)
                            ? "var(--status-warning)"
                            : "var(--foreground-muted)",
                          backgroundColor: reviewQuestionIds.has(question.id)
                            ? "var(--status-warning-surface)"
                            : "var(--card)",
                        }}
                      >
                        <Flag size={14} aria-hidden="true" />
                        {reviewQuestionIds.has(question.id) ? "已标记待检查" : "标记待检查"}
                      </button>
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

      <AlertDialog
        open={confirmationStage === "unanswered"}
        onOpenChange={(open) => {
          if (!open) setConfirmationStage(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>还有 {unansweredCount} 道题未作答</AlertDialogTitle>
            <AlertDialogDescription>
              你可以返回继续作答，也可以进入最终提交确认。未作答题目不会获得分数。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续作答</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={() => setConfirmationStage("final")}
            >
              仍要提交
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmationStage === "final"}
        onOpenChange={(open) => {
          if (!open) setConfirmationStage(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认提交全部答案？</AlertDialogTitle>
            <AlertDialogDescription>
              提交后本次作答将进入判分流程，不能再修改。请确认已经检查完需要复查的题目。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回检查</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={pending}
              onClick={submitAfterConfirmation}
            >
              {pending ? "正在提交…" : "确认提交"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
