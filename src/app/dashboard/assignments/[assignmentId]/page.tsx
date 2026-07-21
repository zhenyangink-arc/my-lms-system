import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Award, CheckCircle2, Clock3, Eye, History, RotateCcw, Timer } from "lucide-react";

import { requireAssignmentViewer } from "@/lib/learning-assignments";
import { AssignmentSubmissionForm } from "../AssignmentSubmissionForm";
import { ASSIGNMENT_TYPE_LABELS, QUESTION_TYPE_LABELS, SUBMISSION_STATUS_LABELS, formatAssignmentDate, type AssignmentType, type QuestionType, type SubmissionStatus } from "../config";


export const runtime = "edge";
type AssignmentRow = { id: string; title: string; description: string; assignment_type: AssignmentType; total_points: number; due_at: string; duration_minutes: number | null; allow_resubmission: boolean };
type QuestionRow = { id: string; question_type: QuestionType; prompt: string; options: unknown; points: number; sort_order: number };
type SubmissionRow = { id: string; attempt_number: number; status: SubmissionStatus; score: number | null; overall_feedback: string | null; submitted_at: string; graded_at: string | null };
type AnswerRow = { id: string; submission_id: string; question_id: string; answer_text: string; awarded_points: number | null; grader_feedback: string | null };

export default async function AssignmentDetailPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  const { supabase, user, isManager } = await requireAssignmentViewer();
  const [assignmentResult, questionsResult, submissionsResult] = await Promise.all([
    supabase.from("learning_assignments").select("id,title,description,assignment_type,total_points,due_at,duration_minutes,allow_resubmission").eq("id", assignmentId).eq("status", "published").maybeSingle(),
    supabase.from("learning_assignment_questions").select("id,question_type,prompt,options,points,sort_order").eq("assignment_id", assignmentId).order("sort_order", { ascending: true }),
    isManager
      ? Promise.resolve({ data: [] as SubmissionRow[], error: null })
      : supabase.from("learning_submissions").select("id,attempt_number,status,score,overall_feedback,submitted_at,graded_at").eq("assignment_id", assignmentId).eq("student_id", user.id).order("attempt_number", { ascending: false }),
  ]);
  if (!assignmentResult.data || assignmentResult.error) notFound();
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
  const overdue = new Date(assignment.due_at).getTime() < new Date().getTime();
  const canSubmit = !isManager && !overdue && (!latest || assignment.allow_resubmission || latest.status === "revision_required");

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/dashboard/assignments" className="inline-flex items-center gap-2 text-xs font-black app-muted-text"><ArrowLeft size={14} />返回任务列表</Link>
      <section className="app-card rounded-3xl border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-end), var(--app-accent-soft))" }}><div className="flex flex-col gap-5 lg:flex-row lg:items-end"><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><span className="rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>{ASSIGNMENT_TYPE_LABELS[assignment.assignment_type]}</span>{latest && <span className="rounded-full px-3 py-1.5 text-xs font-black" style={{ color: latest.status === "graded" ? "var(--app-success)" : latest.status === "revision_required" ? "#c94f45" : "var(--app-warm)", backgroundColor: latest.status === "graded" ? "var(--app-success-soft)" : latest.status === "revision_required" ? "#fff0ed" : "var(--app-warm-soft)" }}>{SUBMISSION_STATUS_LABELS[latest.status]}</span>}</div><h1 className="mt-3 text-2xl font-black tracking-tight">{assignment.title}</h1><p className="app-muted-text mt-4 whitespace-pre-wrap text-sm leading-6">{assignment.description || "请按题目要求完成全部作答。"}</p><div className="app-muted-text mt-4 flex flex-wrap gap-3 text-xs"><span className="inline-flex items-center gap-1"><Clock3 size={13} />截止 {formatAssignmentDate(assignment.due_at)}</span>{assignment.duration_minutes && <span className="inline-flex items-center gap-1"><Timer size={13} />建议 {assignment.duration_minutes} 分钟</span>}<span>{questions.length} 题 · {assignment.total_points} 分</span></div></div>{latest?.status === "graded" && <div className="app-card min-w-[190px] rounded-2xl border p-5 text-center"><Award className="mx-auto" size={24} style={{ color: "var(--app-success)" }} /><p className="mt-2 text-2xl font-black" style={{ color: "var(--app-success)" }}>{latest.score ?? 0}</p><p className="app-muted-text mt-1 text-xs">满分 {assignment.total_points}</p></div>}</div></section>

      {isManager && <section className="app-card rounded-2xl border p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><Eye size={19} /></span><div className="min-w-0 flex-1"><h2 className="font-black">学生端只读预览</h2><p className="app-muted-text mt-1 text-xs leading-5">这里展示学生看到的已发布题目，不显示参考答案，也不能提交作答。</p></div><Link href={`/dashboard/admin/assignments/${assignment.id}`} className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black text-white" style={{ backgroundColor: "var(--app-secondary)" }}>进入后台管理<ArrowRight size={13} /></Link></div></section>}

      {isManager && <section className="space-y-4">{questions.map((question, index) => <article key={question.id} className="app-card rounded-3xl border p-4 sm:p-5"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>{index + 1}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="app-muted-text text-xs font-black">{QUESTION_TYPE_LABELS[question.question_type]}</span><span className="rounded-full px-2 py-0.5 text-xs font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>{question.points} 分</span></div><h2 className="mt-2 whitespace-pre-wrap text-sm font-black leading-7">{question.prompt}</h2></div></div>{question.question_type === "single_choice" && <div className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-2" style={{ borderColor: "var(--app-border-soft)" }}>{(Array.isArray(question.options) ? question.options : []).map((option) => <div key={String(option)} className="app-soft-card rounded-xl border px-3 py-3 text-sm font-bold">{String(option)}</div>)}</div>}{question.question_type !== "single_choice" && <div className="app-soft-card app-muted-text mt-4 rounded-xl border border-dashed px-4 py-5 text-center text-xs">学生将在这里填写{question.question_type === "file_link" ? "附件链接" : question.question_type === "long_text" ? "长文答案" : "简答内容"}</div>}</article>)}</section>}

      {latest?.overall_feedback && <section className="app-card rounded-2xl border p-5" style={{ backgroundColor: latest.status === "revision_required" ? "#fff0ed" : "var(--app-success-soft)" }}><h2 className="flex items-center gap-2 font-black" style={{ color: latest.status === "revision_required" ? "#c94f45" : "var(--app-success)" }}>{latest.status === "revision_required" ? <RotateCcw size={17} /> : <CheckCircle2 size={17} />}老师反馈</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{latest.overall_feedback}</p></section>}

      {latest?.status === "graded" && <section className="app-card rounded-3xl border p-4 sm:p-5"><h2 className="font-black">本次评分明细</h2><div className="mt-4 space-y-3">{questions.map((question, index) => { const answer = answerByQuestion.get(question.id); return <article key={question.id} className="app-soft-card rounded-2xl border p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black">第 {index + 1} 题 · {QUESTION_TYPE_LABELS[question.question_type]}</p><span className="text-xs font-black" style={{ color: "var(--app-success)" }}>{answer?.awarded_points ?? 0} / {question.points} 分</span></div><p className="app-muted-text mt-2 whitespace-pre-wrap text-xs leading-5">你的答案：{answer?.answer_text || "无"}</p>{answer?.grader_feedback && <p className="mt-2 rounded-xl px-3 py-2 text-xs leading-5" style={{ backgroundColor: "var(--app-success-soft)" }}>老师评语：{answer.grader_feedback}</p>}</article>; })}</div></section>}

      {canSubmit ? <AssignmentSubmissionForm assignmentId={assignment.id} questions={questions.map((question) => ({ id: question.id, type: question.question_type, prompt: question.prompt, options: Array.isArray(question.options) ? question.options.map(String) : [], points: Number(question.points) }))} previousAnswers={previousAnswers} /> : !isManager && <section className="app-card rounded-2xl border p-5 text-center"><Clock3 className="mx-auto" size={26} style={{ color: overdue ? "var(--app-warm)" : "var(--app-muted)" }} /><h2 className="mt-3 font-black">{overdue ? "任务已经截止" : "本任务不允许再次提交"}</h2><p className="app-muted-text mt-2 text-xs">{overdue ? "你仍可以查看历史答案与老师反馈。" : "老师退回重做后，提交入口会重新开放。"}</p></section>}

      {submissions.length > 0 && <section className="app-card rounded-3xl border p-5"><h2 className="flex items-center gap-2 font-black"><History size={17} style={{ color: "var(--app-secondary)" }} />提交记录</h2><div className="mt-4 space-y-2">{submissions.map((submission) => <div key={submission.id} className="app-soft-card flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-xs"><span className="font-black">第 {submission.attempt_number} 次</span><span className="rounded-full px-2 py-1 text-xs font-black" style={{ color: submission.status === "graded" ? "var(--app-success)" : submission.status === "revision_required" ? "#c94f45" : "var(--app-warm)", backgroundColor: submission.status === "graded" ? "var(--app-success-soft)" : submission.status === "revision_required" ? "#fff0ed" : "var(--app-warm-soft)" }}>{SUBMISSION_STATUS_LABELS[submission.status]}</span><span className="app-muted-text ml-auto">{formatAssignmentDate(submission.submitted_at)}</span>{submission.status === "graded" && <strong style={{ color: "var(--app-success)" }}>{submission.score ?? 0} 分</strong>}</div>)}</div></section>}
    </div>
  );
}
