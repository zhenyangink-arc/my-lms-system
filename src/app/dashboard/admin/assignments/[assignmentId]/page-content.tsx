import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Award, CheckCircle2, ClipboardCheck, Clock3, KeyRound, UsersRound } from "lucide-react";

import { ASSIGNMENT_DATE_OPTIONS, ASSIGNMENT_STATUS_LABELS, ASSIGNMENT_TYPE_LABELS, QUESTION_TYPE_LABELS, SUBMISSION_STATUS_LABELS, type AssignmentStatus, type AssignmentType, type QuestionType, type SubmissionStatus } from "@/app/dashboard/assignments/config";
import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";
import { LocalDateTime } from "@/components/LocalDateTime";
import { requireAssignmentManager } from "@/lib/learning-assignments";
import { requireTenantAppCapability } from "@/lib/tenant-app-capabilities";
import { AssignmentStatusActions } from "../AssignmentStatusActions";
import { AssignmentDeadlineForm } from "../AssignmentDeadlineForm";
import { SubmissionGradingForm } from "../SubmissionGradingForm";
import { SubmittedAudioAnswer } from "../SubmittedAudioAnswer";
import { AssignmentSkillSummary, type AssignmentSkillScore } from "@/app/dashboard/assignments/AssignmentSkillSummary";

function AssignmentDate({ value }: { value: string | null }) {
  return <LocalDateTime value={value} options={ASSIGNMENT_DATE_OPTIONS} fallback="时间待定" />;
}


type AssignmentRow = { id: string; student_app_id: string; title: string; description: string; assignment_type: AssignmentType; target_scope: string; total_points: number; due_at: string; duration_minutes: number | null; allow_resubmission: boolean; status: AssignmentStatus };
type QuestionRow = { id: string; question_type: QuestionType; language_skill: string; prompt: string; options: unknown; points: number; sort_order: number; source_bank_question_id: string | null; source_bank_version: number | null; auto_graded: boolean };
type KeyRow = { question_id: string; correct_answer: string | null; explanation: string | null };
type SubmissionRow = { id: string; student_id: string; attempt_number: number; status: SubmissionStatus; score: number | null; overall_feedback: string | null; submitted_at: string; graded_at: string | null };
type AnswerRow = { id: string; submission_id: string; question_id: string; answer_text: string; awarded_points: number | null; grader_feedback: string | null };
type StudentRow = { id: string; full_name: string | null; email: string | null };

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2";

function SubmittedAnswer({ question, answer }: { question: QuestionRow; answer: AnswerRow | undefined }) {
  if (!answer) return <p className="mt-2 text-sm">学生答案：未作答</p>;
  if (question.question_type === "audio_recording") {
    return <SubmittedAudioAnswer src={`/api/assignments/recordings/${answer.answer_text}`} />;
  }
  return <p className="mt-2 whitespace-pre-wrap text-sm leading-6">学生答案：{answer.answer_text}</p>;
}

function SubmittedQuestionReview({
  question,
  answer,
  answerKey,
  index,
}: {
  question: QuestionRow;
  answer: AnswerRow | undefined;
  answerKey: KeyRow | undefined;
  index: number | undefined;
}) {
  const body = (
    <>
      <p className="app-muted-text mt-2 text-xs leading-5">题目：{question.prompt}</p>
      <SubmittedAnswer question={question} answer={answer} />
      {answerKey?.correct_answer && (
        <p className="mt-2 text-xs font-bold text-[var(--status-success)]">
          参考答案：{answerKey.correct_answer}
        </p>
      )}
      {answer?.grader_feedback && (
        <p className="mt-2 rounded-lg bg-[var(--status-success-surface)] px-2.5 py-2 text-xs">
          已保存评语：{answer.grader_feedback}
        </p>
      )}
    </>
  );

  if (question.auto_graded) {
    return (
      <details className="app-soft-card rounded-2xl border p-4 opacity-80">
        <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold">
          <span>第 {index} 题 · 系统已判（展开查看）</span>
          <span className="text-[var(--status-success)]">
            {answer?.awarded_points ?? "未评分"} / {question.points} 分
          </span>
        </summary>
        {body}
      </details>
    );
  }

  return (
    <div className="app-soft-card rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold">第 {index} 题 · 需要人工评分</p>
        <span className="text-xs font-semibold text-[var(--foreground-muted)]">
          {answer?.awarded_points ?? "未评分"} / {question.points} 分
        </span>
      </div>
      {body}
    </div>
  );
}

export default async function AssignmentReviewPage({ params, expectedStudentAppId, backHref = "/dashboard/admin/assignments" }: { params: Promise<{ assignmentId: string }>; expectedStudentAppId?: string; backHref?: string }) {
  const { assignmentId } = await params;
  const { supabase } = expectedStudentAppId
    ? await requireTenantAppCapability(expectedStudentAppId, "manageAssessments")
    : await requireAssignmentManager();
  let assignmentQuery = supabase.from("learning_assignments").select("id,student_app_id,title,description,assignment_type,target_scope,total_points,due_at,duration_minutes,allow_resubmission,status").eq("id", assignmentId);
  if (expectedStudentAppId) assignmentQuery = assignmentQuery.eq("student_app_id", expectedStudentAppId);
  const [assignmentResult, questionsResult, keysResult, submissionsResult, targetsResult, studentsResult] = await Promise.all([
    assignmentQuery.maybeSingle(),
    supabase.from("learning_assignment_questions").select("id,question_type,language_skill,prompt,options,points,sort_order,source_bank_question_id,source_bank_version,auto_graded").eq("assignment_id", assignmentId).order("sort_order", { ascending: true }),
    supabase.from("learning_assignment_question_keys").select("question_id,correct_answer,explanation"),
    supabase.from("learning_submissions").select("id,student_id,attempt_number,status,score,overall_feedback,submitted_at,graded_at").eq("assignment_id", assignmentId).order("submitted_at", { ascending: false }),
    supabase.from("learning_assignment_targets").select("student_id").eq("assignment_id", assignmentId),
    expectedStudentAppId
      ? supabase.rpc("list_learning_assignment_students_by_app", {
          p_student_app_id: expectedStudentAppId,
        })
      : supabase.rpc("list_learning_assignment_students"),
  ]);
  if (assignmentResult.error) throw new Error("作业详情读取失败");
  if (!assignmentResult.data) notFound();
  const assignment = assignmentResult.data as AssignmentRow;
  const questions = (questionsResult.data ?? []) as QuestionRow[];
  const questionIds = new Set(questions.map((question) => question.id));
  const keys = ((keysResult.data ?? []) as KeyRow[]).filter((key) => questionIds.has(key.question_id));
  const keyByQuestion = new Map(keys.map((key) => [key.question_id, key]));
  const submissions = (submissionsResult.data ?? []) as SubmissionRow[];
  const submissionIds = submissions.map((submission) => submission.id);
  const { data: answerData, error: answersError } = submissionIds.length ? await supabase.from("learning_submission_answers").select("id,submission_id,question_id,answer_text,awarded_points,grader_feedback").in("submission_id", submissionIds) : { data: [] as AnswerRow[], error: null };
  const answers = (answerData ?? []) as AnswerRow[];
  const answersBySubmission = new Map<string, AnswerRow[]>();
  answers.forEach((answer) => { const current = answersBySubmission.get(answer.submission_id) ?? []; current.push(answer); answersBySubmission.set(answer.submission_id, current); });
  const students = (studentsResult.data ?? []) as StudentRow[];
  const studentNames = new Map(students.map((student) => [student.id, { name: student.full_name?.trim() || "未填写姓名", email: student.email || "未填写邮箱" }]));
  const targetIds = new Set((targetsResult.data ?? []).map((target) => target.student_id as string));
  const targetStudents = students.filter((student) => targetIds.has(student.id));
  const uniqueSubmitters = new Set(submissions.map((submission) => submission.student_id)).size;
  const waitingCount = submissions.filter((submission) => submission.status === "submitted").length;
  const gradedCount = submissions.filter((submission) => submission.status === "graded").length;
  const hasRelatedDataError = Boolean(questionsResult.error || keysResult.error || submissionsResult.error || targetsResult.error || studentsResult.error || answersError);
  const latestGradedSubmissionIds = new Set<string>();
  const gradedStudents = new Set<string>();
  submissions.forEach((submission) => {
    if (submission.status === "graded" && !gradedStudents.has(submission.student_id)) {
      gradedStudents.add(submission.student_id);
      latestGradedSubmissionIds.add(submission.id);
    }
  });
  const latestGradedAnswers = answers.filter((answer) => latestGradedSubmissionIds.has(answer.submission_id));
  const latestGradedAnswerByQuestion = new Map<string, AnswerRow[]>();
  latestGradedAnswers.forEach((answer) => {
    const current = latestGradedAnswerByQuestion.get(answer.question_id) ?? [];
    current.push(answer);
    latestGradedAnswerByQuestion.set(answer.question_id, current);
  });
  const classSkillScores: AssignmentSkillScore[] = (["vocabulary", "grammar", "listening", "speaking", "reading", "writing"] as const).map((skill) => {
    const skillQuestions = questions.filter((question) => question.language_skill === skill);
    return {
      skill,
      earned: skillQuestions.reduce((total, question) => total + (latestGradedAnswerByQuestion.get(question.id) ?? []).reduce((subtotal, answer) => subtotal + Number(answer.awarded_points ?? 0), 0), 0),
      maximum: skillQuestions.reduce((total, question) => total + Number(question.points), 0) * latestGradedSubmissionIds.size,
    };
  });
  const pendingSubmissions = submissions.filter((submission) => submission.status === "submitted");
  const questionIndexById = new Map(questions.map((question, index) => [question.id, index + 1]));

  return (
    <>
      <DashboardPageHeader title="作业批改" />
      <div className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <Link href={backHref} className={`inline-flex items-center gap-2 rounded-md text-xs font-semibold app-muted-text ${focusRing}`}><ArrowLeft size={14} aria-hidden="true" />返回作业与考试</Link>
      {hasRelatedDataError && <section role="alert" className="rounded-2xl border p-4 text-sm font-semibold" style={{ color: "var(--status-danger)", backgroundColor: "var(--status-danger-surface)", borderColor: "var(--status-danger)" }}>部分作业数据暂时无法读取，请刷新页面重试后再批改。</section>}
      <section className="management-detail-summary app-card rounded-3xl border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--card), var(--card), var(--accent))" }}><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_480px] xl:items-end"><div><div className="flex flex-wrap gap-2"><span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ color: "var(--primary)", backgroundColor: "var(--accent)" }}>{ASSIGNMENT_TYPE_LABELS[assignment.assignment_type]}</span><span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ color: assignment.status === "published" ? "var(--status-success)" : assignment.status === "closed" ? "var(--status-warning)" : "var(--foreground-muted)", backgroundColor: assignment.status === "published" ? "var(--status-success-surface)" : assignment.status === "closed" ? "var(--status-warning-surface)" : "var(--surface-soft)" }}>{ASSIGNMENT_STATUS_LABELS[assignment.status]}</span></div><h2 className="mt-3 text-2xl font-semibold tracking-tight">{assignment.title}</h2><p className="app-muted-text mt-4 whitespace-pre-wrap text-sm leading-6">{assignment.description || "暂未填写任务说明"}</p><div className="app-muted-text mt-4 flex flex-wrap gap-3 text-xs"><span>截止 <AssignmentDate value={assignment.due_at} /></span><span>{questions.length} 题 · {assignment.total_points} 分</span>{assignment.duration_minutes && <span>建议 {assignment.duration_minutes} 分钟</span>}<span>{assignment.allow_resubmission ? "允许再次提交" : "仅限一次提交"}</span></div><div className="mt-4"><AssignmentStatusActions id={assignment.id} status={assignment.status} /></div></div><div className="grid grid-cols-3 gap-3">{[["提交学生", uniqueSubmitters, UsersRound, "var(--support)"], ["待批改", waitingCount, Clock3, "var(--primary)"], ["已批改", gradedCount, CheckCircle2, "var(--status-success)"]].map(([label, value, Icon, color]) => { const MetricIcon = Icon as typeof Award; return <div key={String(label)} className="app-card rounded-2xl border p-4 text-center"><MetricIcon className="mx-auto" size={18} style={{ color: String(color) }} aria-hidden="true" /><p className="mt-2 text-2xl font-semibold tabular-nums">{String(value)}</p><p className="app-muted-text text-xs font-semibold">{String(label)}</p></div>; })}</div></div></section>

      {latestGradedSubmissionIds.size > 0 && <AssignmentSkillSummary scores={classSkillScores} title="班级六项能力表现" />}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]"><div className="app-card rounded-2xl border p-5"><div className="flex items-start gap-3"><UsersRound className="mt-0.5 shrink-0" size={18} style={{ color: "var(--support)" }} aria-hidden="true" /><div><h2 className="font-semibold">分配范围：{assignment.target_scope === "all_students" ? "全部在籍学生" : `指定 ${targetStudents.length} 名学生`}</h2>{assignment.target_scope === "selected_students" && <div className="mt-3 flex flex-wrap gap-2">{targetStudents.map((student) => <span key={student.id} className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: "var(--support)", backgroundColor: "var(--support-surface)" }}>{student.full_name || student.email || "未填写姓名"}</span>)}</div>}<p className="app-muted-text mt-2 text-xs">{assignment.target_scope === "all_students" ? `当前共有 ${students.length} 名正常学生账号可查看。` : "只有以上学生可以查看和提交本任务。"}</p></div></div></div><AssignmentDeadlineForm assignmentId={assignment.id} /></section>

      <section className="app-card rounded-3xl border p-4 sm:p-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><KeyRound size={18} style={{ color: "var(--primary)" }} aria-hidden="true" />题目与批改参考</h2><div className="mt-4 grid gap-3 lg:grid-cols-2">{questions.map((question, index) => { const key = keyByQuestion.get(question.id); return <article key={question.id} className="app-soft-card rounded-2xl border p-4"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold">第 {index + 1} 题 · {QUESTION_TYPE_LABELS[question.question_type]}</p>{question.source_bank_question_id && <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: "var(--status-success)", backgroundColor: "var(--status-success-surface)" }}>平台标准题库 · 版本 {question.source_bank_version ?? 1}</span>}<span className="ml-auto text-xs font-semibold" style={{ color: "var(--support)" }}>{question.points} 分</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{question.prompt}</p>{key?.correct_answer && <p className="mt-3 rounded-xl px-3 py-2 text-xs font-bold" style={{ color: "var(--status-success)", backgroundColor: "var(--status-success-surface)" }}>参考答案：{key.correct_answer}</p>}{key?.explanation && <p className="app-muted-text mt-2 text-xs leading-5">解析：{key.explanation}</p>}</article>; })}{!questionsResult.error && questions.length === 0 && <div className="app-muted-text rounded-2xl border border-dashed p-6 text-center text-sm lg:col-span-2">此作业尚未配置题目。</div>}</div></section>

      {pendingSubmissions.length > 0 && <nav aria-label="待批改学生快捷入口" className="app-card rounded-2xl border p-4"><div className="flex flex-wrap items-center gap-2"><strong className="mr-1 text-xs">待批改快速跳转</strong>{pendingSubmissions.map((submission) => { const student = studentNames.get(submission.student_id); return <a key={submission.id} href={`#submission-${submission.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-bold text-[var(--primary)]">{student?.name ?? "学生"} · 第 {submission.attempt_number} 次</a>; })}</div></nav>}

      <section className="space-y-4"><div><h2 className="text-xl font-semibold">学生提交</h2><p className="app-muted-text mt-1 text-xs">共 {submissions.length} 次提交；每份提交先显示主观题，客观题已经由系统预判并默认收起。</p></div>{submissions.map((submission) => { const student = studentNames.get(submission.student_id) ?? { name: "学生账号", email: `账号 …${submission.student_id.slice(-6)}` }; const submissionAnswers = answersBySubmission.get(submission.id) ?? []; const answerMap = new Map(submissionAnswers.map((answer) => [answer.question_id, answer])); const orderedQuestions = [...questions].sort((left, right) => Number(left.auto_graded) - Number(right.auto_graded)); return <article id={`submission-${submission.id}`} key={submission.id} className="app-card scroll-mt-24 rounded-3xl border p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-semibold" style={{ color: "var(--primary)", backgroundColor: "var(--accent)" }} aria-hidden="true">{student.name.slice(0, 1)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{student.name}</h3><span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: submission.status === "graded" ? "var(--status-success)" : submission.status === "revision_required" ? "var(--status-danger)" : "var(--status-warning)", backgroundColor: submission.status === "graded" ? "var(--status-success-surface)" : submission.status === "revision_required" ? "var(--status-danger-surface)" : "var(--status-warning-surface)" }}>{SUBMISSION_STATUS_LABELS[submission.status]}</span><span className="app-muted-text text-xs font-bold">第 {submission.attempt_number} 次提交</span></div><p className="app-muted-text mt-1 text-xs">{student.email} · <AssignmentDate value={submission.submitted_at} /></p>{submission.status === "graded" && <p className="mt-2 text-2xl font-semibold tabular-nums" style={{ color: "var(--status-success)" }}>{submission.score ?? 0}<span className="ml-1 text-xs app-muted-text">/ {assignment.total_points} 分</span></p>}{submission.overall_feedback && <p className="mt-3 rounded-xl px-3 py-2 text-xs leading-5" style={{ backgroundColor: submission.status === "revision_required" ? "var(--status-danger-surface)" : "var(--status-success-surface)" }}>总体评语：{submission.overall_feedback}</p>}</div></div><div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(330px,0.7fr)]"><div className="space-y-3">{orderedQuestions.map((question) => <SubmittedQuestionReview key={question.id} question={question} answer={answerMap.get(question.id)} answerKey={keyByQuestion.get(question.id)} index={questionIndexById.get(question.id)} />)}</div><SubmissionGradingForm submissionId={submission.id} answers={questions.map((question, index) => { const answer = answerMap.get(question.id); return { id: answer?.id ?? "", index: index + 1, maxPoints: Number(question.points), awardedPoints: answer?.awarded_points ?? null, feedback: answer?.grader_feedback ?? null, autoGraded: question.auto_graded }; }).filter((answer) => Boolean(answer.id))} /></div></article>; })}{!submissionsResult.error && submissions.length === 0 && <div className="app-card rounded-3xl border border-dashed p-8 text-center"><ClipboardCheck className="mx-auto opacity-30" size={34} aria-hidden="true" /><p className="mt-3 font-semibold">暂时没有学生提交</p></div>}</section>
      </div>
    </>
  );
}
