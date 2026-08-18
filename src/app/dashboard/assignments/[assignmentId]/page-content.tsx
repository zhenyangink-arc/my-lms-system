import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Award, CheckCircle2, Clock3, Eye, History, RotateCcw, Timer } from "lucide-react";

import { requireAssignmentViewer } from "@/lib/learning-assignments";
import { AssignmentSubmissionForm } from "../AssignmentSubmissionForm";
import { AssignmentSkillSummary, type AssignmentSkillScore } from "../AssignmentSkillSummary";
import { AssignmentRemediationPractice } from "../AssignmentRemediationPractice";
import { ASSIGNMENT_DATE_OPTIONS, ASSIGNMENT_TYPE_LABELS, QUESTION_TYPE_LABELS, SUBMISSION_STATUS_LABELS, type AssignmentType, type QuestionType, type SubmissionStatus } from "../config";
import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";
import { LocalDateTime } from "@/components/LocalDateTime";
import {
  getAssignmentDetail,
  type AssignmentDetailRow,
} from "@/lib/assignment-detail-data";
import { requireDashboardAccess } from "@/lib/dashboard-access";
import { STUDENT_APP_IDS } from "@/lib/student-apps";

function AssignmentDate({ value }: { value: string | null }) {
  return <LocalDateTime value={value} options={ASSIGNMENT_DATE_OPTIONS} fallback="时间待定" />;
}


type AssignmentRow = Omit<AssignmentDetailRow, "status" | "student_app_id"> & { assignment_type: AssignmentType };
type QuestionRow = { id: string; question_type: QuestionType; language_skill: "vocabulary" | "grammar" | "listening" | "speaking" | "reading" | "writing" | ""; stimulus_text: string; prompt: string; options: unknown; points: number; sort_order: number; auto_graded: boolean };
type SubmissionRow = { id: string; attempt_number: number; status: SubmissionStatus; score: number | null; overall_feedback: string | null; submitted_at: string; graded_at: string | null };
type AnswerRow = { id: string; submission_id: string; question_id: string; answer_text: string; awarded_points: number | null; grader_feedback: string | null };
type DraftRow = { answers: unknown; active_step: number; updated_at: string };
type AssignmentWindowRow = { chapter_completed: boolean; unlocked_at: string | null; effective_due_at: string | null; due_days_after_unlock: number | null };

export default async function AssignmentDetailPage({ params }: { params: Promise<{ assignmentId: string; space?: string }> }) {
  const { assignmentId, space } = await params;
  const { supabase, user, isManager } = await requireAssignmentViewer();
  const assignmentPromise = space
    ? (async () => {
        const access = await requireDashboardAccess("tenant", space);
        return getAssignmentDetail(
          access.auth.supabase,
          access.tenantSlug ?? space,
          STUDENT_APP_IDS.korean,
          assignmentId,
        );
      })()
    : supabase.from("learning_assignments").select("id,title,description,institution_note,assignment_type,total_points,starts_at,due_at,duration_minutes,allow_resubmission,source_paper_code,source_paper_version,unlock_after_chapter_completion,unlock_test_slug").eq("id", assignmentId).eq("status", "published").maybeSingle();
  const [assignmentResult, questionsResult, submissionsResult, chapterCompletionResult, draftResult, windowResult] = await Promise.all([
    assignmentPromise,
    supabase.from("learning_assignment_questions").select("id,question_type,language_skill,stimulus_text,prompt,options,points,sort_order,auto_graded").eq("assignment_id", assignmentId).order("sort_order", { ascending: true }),
    isManager
      ? Promise.resolve({ data: [] as SubmissionRow[], error: null })
      : supabase.from("learning_submissions").select("id,attempt_number,status,score,overall_feedback,submitted_at,graded_at").eq("assignment_id", assignmentId).eq("student_id", user.id).order("attempt_number", { ascending: false }),
    supabase.rpc("current_user_completed_assignment_chapter", {
      p_assignment_id: assignmentId,
    }),
    isManager
      ? Promise.resolve({ data: null as DraftRow | null, error: null })
      : supabase.from("learning_assignment_drafts").select("answers,active_step,updated_at").eq("assignment_id", assignmentId).eq("student_id", user.id).maybeSingle(),
    supabase.rpc("current_user_assignment_window", {
      p_assignment_id: assignmentId,
    }),
  ]);
  if (
    !assignmentResult.data ||
    assignmentResult.error ||
    (space && (assignmentResult.data as AssignmentDetailRow).status !== "published")
  ) notFound();
  const assignment = assignmentResult.data as AssignmentRow;
  const questions = (questionsResult.data ?? []) as QuestionRow[];
  const submissions = (submissionsResult.data ?? []) as SubmissionRow[];
  const latest = submissions[0] ?? null;
  const submissionIds = submissions.map((submission) => submission.id);
  const { data: answerData } = submissionIds.length ? await supabase.from("learning_submission_answers").select("id,submission_id,question_id,answer_text,awarded_points,grader_feedback").in("submission_id", submissionIds) : { data: [] as AnswerRow[] };
  const answers = (answerData ?? []) as AnswerRow[];
  const latestAnswers = answers.filter((answer) => answer.submission_id === latest?.id);
  const previousAnswers = Object.fromEntries(latestAnswers.map((answer) => [answer.question_id, answer.answer_text]));
  const answerByQuestion = new Map(latestAnswers.map((answer) => [answer.question_id, answer]));
  const objectiveQuestions = questions.filter((question) => question.auto_graded);
  const objectiveQuestionIds = new Set(objectiveQuestions.map((question) => question.id));
  const objectiveAnswers = latestAnswers.filter((answer) => objectiveQuestionIds.has(answer.question_id));
  const objectiveEarned = objectiveAnswers.reduce((total, answer) => total + Number(answer.awarded_points ?? 0), 0);
  const objectiveMaximum = objectiveQuestions.reduce((total, question) => total + Number(question.points), 0);
  const assignmentWindow = ((windowResult.data ?? [])[0] ?? null) as AssignmentWindowRow | null;
  const effectiveDueAt = assignmentWindow?.effective_due_at ?? assignment.due_at;
  const overdue = Boolean(effectiveDueAt && new Date(effectiveDueAt).getTime() < new Date().getTime());
  const notStarted = new Date(assignment.starts_at).getTime() > new Date().getTime();
  const chapterCompleted = assignmentWindow?.chapter_completed ?? chapterCompletionResult.data !== false;
  const waitingForChapter = assignment.unlock_after_chapter_completion && !chapterCompleted;
  const canSubmit = !isManager && !notStarted && !overdue && !waitingForChapter && (!latest || assignment.allow_resubmission || latest.status === "revision_required");
  const cloudDraftRow = (draftResult.data ?? null) as DraftRow | null;
  const cloudDraft = cloudDraftRow && cloudDraftRow.answers && typeof cloudDraftRow.answers === "object" && !Array.isArray(cloudDraftRow.answers) ? { answers: Object.fromEntries(Object.entries(cloudDraftRow.answers).map(([key, value]) => [key, String(value ?? "")])), activeStep: cloudDraftRow.active_step, savedAt: cloudDraftRow.updated_at } : null;
  const skillScores: AssignmentSkillScore[] = (["vocabulary", "grammar", "listening", "speaking", "reading", "writing"] as const).map((skill) => {
    const skillQuestions = questions.filter((question) => question.language_skill === skill);
    return {
      skill,
      earned: skillQuestions.reduce((total, question) => total + Number(answerByQuestion.get(question.id)?.awarded_points ?? 0), 0),
      maximum: skillQuestions.reduce((total, question) => total + Number(question.points), 0),
    };
  });
  const remediationQuestions = latest?.status === "graded" ? objectiveQuestions.filter((question) => Number(answerByQuestion.get(question.id)?.awarded_points ?? 0) < Number(question.points)).map((question) => ({ id: question.id, prompt: question.prompt, options: Array.isArray(question.options) ? question.options.map(String) : [], previousAnswer: answerByQuestion.get(question.id)?.answer_text ?? "" })) : [];

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <Link href={`/dashboard/assignments?type=${assignment.assignment_type === "exam" ? "exam" : "homework"}`} className="inline-flex items-center gap-2 text-xs font-bold app-muted-text"><ArrowLeft size={14} />返回任务列表</Link>
      <section className="app-card rounded-3xl border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--card), var(--accent), var(--accent))" }}><div className="flex flex-col gap-5 lg:flex-row lg:items-end"><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><span className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ color: "var(--primary)", backgroundColor: "var(--accent)" }}>{ASSIGNMENT_TYPE_LABELS[assignment.assignment_type]}</span>{assignment.source_paper_code && <span className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ color: "var(--support)", backgroundColor: "var(--support-surface)" }}>{assignment.source_paper_code} · 版本 {assignment.source_paper_version ?? 1}</span>}{latest && <span className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ color: latest.status === "graded" ? "var(--status-success)" : latest.status === "revision_required" ? "#c94f45" : "var(--status-warning)", backgroundColor: latest.status === "graded" ? "var(--status-success-surface)" : latest.status === "revision_required" ? "#fff0ed" : "var(--status-warning-surface)" }}>{SUBMISSION_STATUS_LABELS[latest.status]}</span>}</div><h2 className="mt-3 text-2xl font-bold tracking-tight">{assignment.title}</h2><p className="app-muted-text mt-4 whitespace-pre-wrap text-sm leading-6">{assignment.description || "请按题目要求完成全部作答。"}</p>{assignment.institution_note && <p className="mt-3 rounded-xl px-3 py-2 text-xs leading-5" style={{ backgroundColor: "var(--support-surface)" }}>机构通知：{assignment.institution_note}</p>}<div className="app-muted-text mt-4 flex flex-wrap gap-3 text-xs"><span className="inline-flex items-center gap-1"><Clock3 size={13} />开始 <AssignmentDate value={assignment.starts_at} /></span><span className="inline-flex items-center gap-1"><Clock3 size={13} />{waitingForChapter && assignmentWindow?.due_days_after_unlock ? `完成章节后 ${assignmentWindow.due_days_after_unlock} 天内提交` : <>截止 <AssignmentDate value={effectiveDueAt} /></>}</span>{assignment.duration_minutes && <span className="inline-flex items-center gap-1"><Timer size={13} />建议 {assignment.duration_minutes} 分钟</span>}<span>{notStarted ? "题目将在开始后开放" : `${questions.length} 题 · ${assignment.total_points} 分`}</span></div></div>{latest?.status === "graded" && <div className="app-card min-w-[190px] rounded-2xl border p-5 text-center"><Award className="mx-auto" size={24} style={{ color: "var(--status-success)" }} /><p className="mt-2 text-2xl font-bold" style={{ color: "var(--status-success)" }}>{latest.score ?? 0}</p><p className="app-muted-text mt-1 text-xs">满分 {assignment.total_points}</p></div>}</div></section>

      {isManager && <section className="app-card rounded-2xl border p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color: "var(--primary)", backgroundColor: "var(--accent)" }}><Eye size={19} /></span><div className="min-w-0 flex-1"><DashboardTitleWithHint headingLevel={2} titleClassName="font-bold" title={<>学生端只读预览</>} description={<>这里展示学生看到的已发布题目，不显示参考答案，也不能提交作答。</>} /></div><Link href={`/dashboard/admin/assignments/${assignment.id}`} className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white" style={{ backgroundColor: "var(--support)" }}>进入后台管理<ArrowRight size={13} /></Link></div></section>}

      {isManager && <section className="space-y-4">{questions.map((question, index) => <article key={question.id} className="app-card rounded-3xl border p-4 sm:p-5"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold" style={{ color: "var(--primary)", backgroundColor: "var(--accent)" }}>{index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="app-muted-text text-xs font-bold">{QUESTION_TYPE_LABELS[question.question_type]}</span><span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ color: "var(--support)", backgroundColor: "var(--support-surface)" }}>{question.points} 分</span></div><h2 className="mt-2 whitespace-pre-wrap text-sm font-bold leading-7">{question.prompt}</h2></div></div>{question.question_type === "single_choice" && <div className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-2" style={{ borderColor: "var(--border-subtle)" }}>{(Array.isArray(question.options) ? question.options : []).map((option) => <div key={String(option)} className="app-soft-card rounded-xl border px-3 py-3 text-sm font-bold">{String(option)}</div>)}</div>}{question.question_type !== "single_choice" && <div className="app-soft-card app-muted-text mt-4 rounded-xl border border-dashed px-4 py-5 text-center text-xs">学生将在这里填写{question.question_type === "file_link" ? "附件链接" : question.question_type === "long_text" ? "长文答案" : "简答内容"}</div>}</article>)}</section>}

      {latest?.overall_feedback && <section className="app-card rounded-2xl border p-5" style={{ backgroundColor: latest.status === "revision_required" ? "#fff0ed" : "var(--status-success-surface)" }}><h2 className="flex items-center gap-2 font-bold" style={{ color: latest.status === "revision_required" ? "#c94f45" : "var(--status-success)" }}>{latest.status === "revision_required" ? <RotateCcw size={17} /> : <CheckCircle2 size={17} />}老师反馈</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{latest.overall_feedback}</p></section>}

      {latest && objectiveAnswers.length > 0 && <section className="app-card rounded-2xl border p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--status-success-surface)] text-[var(--status-success)]"><CheckCircle2 size={19} aria-hidden="true" /></span><div className="min-w-0 flex-1"><h2 className="font-bold">客观题即时结果</h2><p className="app-muted-text mt-1 text-xs">系统已自动判定 {objectiveAnswers.length} / {objectiveQuestions.length} 道；口语、阅读和写作等题目仍由老师批改。</p></div><div className="rounded-2xl bg-[var(--status-success-surface)] px-5 py-3 text-center"><strong className="text-xl tabular-nums text-[var(--status-success)]">{objectiveEarned}</strong><span className="app-muted-text ml-1 text-xs">/ {objectiveMaximum} 分</span></div></div></section>}

      {latest?.status === "graded" && <section className="app-card rounded-3xl border p-4 sm:p-5"><h2 className="font-bold">本次评分明细</h2><div className="mt-4 space-y-3">{questions.map((question, index) => { const answer = answerByQuestion.get(question.id); return <article key={question.id} className="app-soft-card rounded-2xl border p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold">第 {index + 1} 题 · {QUESTION_TYPE_LABELS[question.question_type]}</p><span className="text-xs font-bold" style={{ color: "var(--status-success)" }}>{answer?.awarded_points ?? 0} / {question.points} 分</span></div><p className="app-muted-text mt-2 whitespace-pre-wrap text-xs leading-5">你的答案：{answer?.answer_text || "无"}</p>{answer?.grader_feedback && <p className="mt-2 rounded-xl px-3 py-2 text-xs leading-5" style={{ backgroundColor: "var(--status-success-surface)" }}>老师评语：{answer.grader_feedback}</p>}</article>; })}</div></section>}

      {latest?.status === "graded" && <AssignmentSkillSummary scores={skillScores} />}
      {latest?.status === "graded" && <AssignmentRemediationPractice questions={remediationQuestions} />}

      {canSubmit ? <AssignmentSubmissionForm assignmentId={assignment.id} studentId={user.id} questions={questions.map((question) => ({ id: question.id, type: question.question_type, languageSkill: question.language_skill, stimulusText: question.stimulus_text, prompt: question.prompt, options: Array.isArray(question.options) ? question.options.map(String) : [], points: Number(question.points) }))} previousAnswers={previousAnswers} cloudDraft={cloudDraft} /> : !isManager && <section className="app-card rounded-2xl border p-5 text-center"><Clock3 className="mx-auto" size={26} style={{ color: overdue ? "var(--status-warning)" : "var(--foreground-muted)" }} /><h2 className="mt-3 font-bold">{waitingForChapter ? "完成本章学习后开放" : notStarted ? "任务还未开始" : overdue ? "任务已经截止" : "本任务不允许再次提交"}</h2><p className="app-muted-text mt-2 text-xs">{waitingForChapter ? assignmentWindow?.due_days_after_unlock ? `完成对应章节后，你将有 ${assignmentWindow.due_days_after_unlock} 天完成这份作业。` : "完成对应章节的智能教材，或达到电子书阅读完成要求后，六项题目会自动开放。" : notStarted ? <>题目将在 <AssignmentDate value={assignment.starts_at} /> 自动开放。</> : overdue ? "你仍可以查看历史答案与老师反馈。" : "老师退回重做后，提交入口会重新开放。"}</p></section>}

      {submissions.length > 0 && <section className="app-card rounded-3xl border p-5"><h2 className="flex items-center gap-2 font-bold"><History size={17} style={{ color: "var(--support)" }} />提交记录</h2><div className="mt-4 space-y-2">{submissions.map((submission) => <div key={submission.id} className="app-soft-card flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-xs"><span className="font-bold">第 {submission.attempt_number} 次</span><span className="rounded-full px-2 py-1 text-xs font-bold" style={{ color: submission.status === "graded" ? "var(--status-success)" : submission.status === "revision_required" ? "#c94f45" : "var(--status-warning)", backgroundColor: submission.status === "graded" ? "var(--status-success-surface)" : submission.status === "revision_required" ? "#fff0ed" : "var(--status-warning-surface)" }}>{SUBMISSION_STATUS_LABELS[submission.status]}</span><span className="app-muted-text ml-auto"><AssignmentDate value={submission.submitted_at} /></span>{submission.status === "graded" && <strong style={{ color: "var(--status-success)" }}>{submission.score ?? 0} 分</strong>}</div>)}</div></section>}
    </div>
  );
}
