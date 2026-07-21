import Link from "next/link";
import { ArrowRight, Award, CheckCircle2, ClipboardList, Clock3, FilePenLine, RotateCcw, Timer } from "lucide-react";

import { requireAssignmentViewer } from "@/lib/learning-assignments";
import { ASSIGNMENT_TYPE_LABELS, SUBMISSION_STATUS_LABELS, formatAssignmentDate, type AssignmentType, type SubmissionStatus } from "./config";


export const runtime = "edge";
type AssignmentRow = { id: string; title: string; description: string; assignment_type: AssignmentType; course_id: string | null; total_points: number; due_at: string; duration_minutes: number | null; allow_resubmission: boolean };
type SubmissionRow = { id: string; assignment_id: string; attempt_number: number; status: SubmissionStatus; score: number | null; overall_feedback: string | null; submitted_at: string };
type CourseRow = { id: string; title: string };

function latestSubmissions(submissions: SubmissionRow[]) {
  const latest = new Map<string, SubmissionRow>();
  submissions.forEach((submission) => {
    const current = latest.get(submission.assignment_id);
    if (!current || submission.attempt_number > current.attempt_number) latest.set(submission.assignment_id, submission);
  });
  return latest;
}

export default async function AssignmentsPage() {
  const { supabase, user, isManager } = await requireAssignmentViewer();
  const [assignmentsResult, submissionsResult] = await Promise.all([
    supabase.from("learning_assignments").select("id,title,description,assignment_type,course_id,total_points,due_at,duration_minutes,allow_resubmission").eq("status", "published").order("due_at", { ascending: true }),
    isManager
      ? Promise.resolve({ data: [] as SubmissionRow[], error: null })
      : supabase.from("learning_submissions").select("id,assignment_id,attempt_number,status,score,overall_feedback,submitted_at").eq("student_id", user.id).order("attempt_number", { ascending: false }),
  ]);
  const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
  const submissions = (submissionsResult.data ?? []) as SubmissionRow[];
  const latestByAssignment = latestSubmissions(submissions);
  const courseIds = [...new Set(assignments.map((assignment) => assignment.course_id).filter((value): value is string => Boolean(value)))];
  const { data: courseData } = courseIds.length ? await supabase.from("courses").select("id,title").in("id", courseIds) : { data: [] as CourseRow[] };
  const courseNames = new Map(((courseData ?? []) as CourseRow[]).map((course) => [course.id, course.title]));
  const now = new Date().getTime();
  const pendingCount = assignments.filter((assignment) => !latestByAssignment.has(assignment.id) && new Date(assignment.due_at).getTime() >= now).length;
  const waitingCount = [...latestByAssignment.values()].filter((submission) => submission.status === "submitted").length;
  const gradedCount = [...latestByAssignment.values()].filter((submission) => submission.status === "graded").length;
  const activeCount = assignments.filter((assignment) => new Date(assignment.due_at).getTime() >= now).length;
  const overviewMetrics = isManager
    ? [["已发布", assignments.length, ClipboardList, "var(--app-accent)", "var(--app-accent-soft)"], ["进行中", activeCount, Clock3, "var(--app-success)", "var(--app-success-soft)"], ["已截止", assignments.length - activeCount, CheckCircle2, "var(--app-warm)", "var(--app-warm-soft)"]]
    : [["待完成", pendingCount, FilePenLine, "var(--app-accent)", "var(--app-accent-soft)"], ["待批改", waitingCount, Clock3, "var(--app-warm)", "var(--app-warm-soft)"], ["已出分", gradedCount, Award, "var(--app-success)", "var(--app-success-soft)"]];

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8">
        {isManager && (
          <div className="flex justify-end">
            <Link href="/dashboard/admin/assignments" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white" style={{ backgroundColor: "var(--app-secondary)" }}>进入后台管理<ArrowRight size={15} /></Link>
          </div>
        )}
        <section className="app-card overflow-hidden rounded-3xl border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--app-hero-end), var(--app-card-bg), var(--app-secondary-soft))" }}>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-end"><div><span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><ClipboardList size={15} />{isManager ? "学生端预览" : "我的学习任务"}</span><h2 className="mt-3 text-2xl font-black tracking-tight">{isManager ? "检查学生实际看到的任务页面" : "每次提交都有记录，每份反馈都有下一步"}</h2><p className="app-muted-text mt-2 max-w-2xl text-sm leading-6">{isManager ? "这里只展示已经发布的任务，页面不会进入布置或批改流程。需要管理时请使用右上角的后台入口。" : "作业、章节测验和考试统一按截止时间排列。老师退回后可以按意见重新提交，历史版本不会丢失。"}</p></div><div className="grid grid-cols-3 gap-3">{overviewMetrics.map(([label, value, Icon, color, soft]) => { const MetricIcon = Icon as typeof Award; return <div key={String(label)} className="app-card rounded-2xl border p-4 text-center"><span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: String(color), backgroundColor: String(soft) }}><MetricIcon size={17} /></span><p className="mt-2 text-2xl font-black">{String(value)}</p><p className="app-muted-text text-xs font-black">{String(label)}</p></div>; })}</div></div>
        </section>

        {(assignmentsResult.error || submissionsResult.error) && <section className="rounded-2xl border p-4 text-sm font-bold" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)", borderColor: "var(--app-warm)" }}>学习任务暂时无法读取，请确认最新数据库迁移已经执行。</section>}

        <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {assignments.map((assignment) => {
            const latest = latestByAssignment.get(assignment.id);
            const overdue = new Date(assignment.due_at).getTime() < now;
            const status = isManager ? (overdue ? "overdue" : "preview") : latest?.status ?? (overdue ? "overdue" : "pending");
            const tone = status === "graded" ? { color: "var(--app-success)", soft: "var(--app-success-soft)" } : status === "revision_required" || status === "overdue" ? { color: "#c94f45", soft: "#fff0ed" } : status === "submitted" ? { color: "var(--app-warm)", soft: "var(--app-warm-soft)" } : { color: "var(--app-accent)", soft: "var(--app-accent-soft)" };
            const label = status === "overdue" ? "已截止" : status === "preview" ? "学生端预览" : status === "pending" ? "待完成" : SUBMISSION_STATUS_LABELS[status];
            return <Link key={assignment.id} href={`/dashboard/assignments/${assignment.id}`} className="app-card group flex h-full flex-col rounded-[1.75rem] border p-5 transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-secondary)", backgroundColor: "var(--app-secondary-soft)" }}>{ASSIGNMENT_TYPE_LABELS[assignment.assignment_type]}</span><span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: tone.color, backgroundColor: tone.soft }}>{label}</span><ArrowRight className="ml-auto transition group-hover:translate-x-1" size={16} /></div><h3 className="mt-4 text-lg font-black leading-7">{assignment.title}</h3><p className="app-muted-text mt-2 line-clamp-3 text-xs leading-5">{assignment.description || "打开任务查看完整题目和作答要求。"}</p><div className="mt-4 flex flex-wrap gap-2 text-xs font-bold app-muted-text"><span className="rounded-lg px-2 py-1" style={{ backgroundColor: "var(--app-soft-bg)" }}>{assignment.total_points} 分</span>{assignment.duration_minutes && <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1" style={{ backgroundColor: "var(--app-soft-bg)" }}><Timer size={11} />建议 {assignment.duration_minutes} 分钟</span>}<span className="rounded-lg px-2 py-1" style={{ backgroundColor: "var(--app-soft-bg)" }}>{assignment.course_id ? courseNames.get(assignment.course_id) ?? "关联课程" : "综合任务"}</span></div><div className="mt-auto border-t pt-4" style={{ borderColor: "var(--app-border-soft)" }}><p className="text-xs font-black">截止：{formatAssignmentDate(assignment.due_at)}</p>{latest?.status === "graded" && <p className="mt-2 text-2xl font-black" style={{ color: "var(--app-success)" }}>{latest.score ?? 0}<span className="ml-1 text-xs app-muted-text">/ {assignment.total_points} 分</span></p>}{latest?.status === "revision_required" && <p className="mt-2 flex items-center gap-1.5 text-xs font-black" style={{ color: "#c94f45" }}><RotateCcw size={13} />请按老师意见重新提交</p>}</div></Link>;
          })}
          {!assignmentsResult.error && assignments.length === 0 && <div className="app-card col-span-full rounded-[1.75rem] border border-dashed p-8 text-center"><CheckCircle2 className="mx-auto" size={34} style={{ color: "var(--app-success)" }} /><p className="mt-4 font-black">当前没有待开放的任务</p><p className="app-muted-text mt-2 text-sm">老师发布新作业或考试后，会自动出现在这里。</p></div>}
        </section>
      </div>
    </div>
  );
}
