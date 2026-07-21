import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardCheck, ClipboardList, Clock3, FilePenLine, Send, UsersRound } from "lucide-react";

import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";
import { ASSIGNMENT_STATUS_LABELS, ASSIGNMENT_TYPE_LABELS, formatAssignmentDate, type AssignmentStatus, type AssignmentType } from "@/app/dashboard/assignments/config";
import { requireAssignmentManager } from "@/lib/learning-assignments";
import { MEMBERSHIP_TIER_LABELS, normalizeMembershipTier } from "@/lib/student-permissions";
import { AssignmentComposer } from "./AssignmentComposer";
import { AssignmentStatusActions } from "./AssignmentStatusActions";


type AssignmentRow = { id: string; title: string; description: string; assignment_type: AssignmentType; course_id: string | null; target_scope: string; total_points: number; due_at: string; duration_minutes: number | null; allow_resubmission: boolean; status: AssignmentStatus; created_at: string };
type SubmissionRow = { assignment_id: string; student_id: string; status: string; score: number | null; attempt_number: number };
type CourseRow = { id: string; title: string };
type StudentRow = { id: string; full_name: string | null; email: string | null; membership_tier: string | null };

const statusTones: Record<AssignmentStatus, { color: string; soft: string }> = {
  draft: { color: "var(--app-muted)", soft: "var(--app-soft-bg)" },
  published: { color: "var(--app-success)", soft: "var(--app-success-soft)" },
  closed: { color: "var(--app-warm)", soft: "var(--app-warm-soft)" },
};

export default async function AssignmentManagementPage() {
  const { supabase, role } = await requireAssignmentManager();
  const [assignmentsResult, submissionsResult, coursesResult, studentsResult] = await Promise.all([
    supabase.from("learning_assignments").select("id,title,description,assignment_type,course_id,target_scope,total_points,due_at,duration_minutes,allow_resubmission,status,created_at").order("created_at", { ascending: false }),
    supabase.from("learning_submissions").select("assignment_id,student_id,status,score,attempt_number"),
    supabase.from("courses").select("id,title").eq("is_published", true).order("title", { ascending: true }),
    supabase.rpc("list_learning_assignment_students"),
  ]);
  const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
  const submissions = (submissionsResult.data ?? []) as SubmissionRow[];
  const courses = (coursesResult.data ?? []) as CourseRow[];
  const students = (studentsResult.data ?? []) as StudentRow[];
  const courseNames = new Map(courses.map((course) => [course.id, course.title]));

  const submissionsByAssignment = new Map<string, SubmissionRow[]>();
  submissions.forEach((submission) => {
    const current = submissionsByAssignment.get(submission.assignment_id) ?? [];
    current.push(submission);
    submissionsByAssignment.set(submission.assignment_id, current);
  });

  const publishedCount = assignments.filter((assignment) => assignment.status === "published").length;
  const pendingCount = submissions.filter((submission) => submission.status === "submitted").length;
  const gradedCount = submissions.filter((submission) => submission.status === "graded").length;

  return (
    <div className="pb-12">
      <DashboardPageHeader title="作业与考试管理" description="布置任务、控制发布、查看提交并逐题批改。" action={<Link href="#create-assignment" className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white" style={{ backgroundColor: "var(--app-accent)" }}><FilePenLine size={16} />布置任务</Link>} />
      <div className="mx-auto mt-5 w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8">
        <section className="app-card overflow-hidden rounded-3xl border p-5 sm:p-6" style={{ background: "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-start), var(--app-accent-soft))" }}>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_560px] xl:items-end">
            <div><span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}><ClipboardCheck size={15} />教学任务工作台</span><h2 className="mt-3 text-2xl font-black tracking-tight">从布置到反馈形成完整闭环</h2><p className="app-muted-text mt-2 max-w-2xl text-sm leading-6">支持作业、测验和考试，既可发给全部学生，也可指定学生。每次提交都会保留独立版本，方便追踪进步。</p><p className="app-muted-text mt-3 text-xs">当前身份：{role === "teacher" ? "教师" : role === "admin" ? "管理员" : role === "ceo" ? "运营负责人" : "负责人"}</p></div>
            <div className="grid grid-cols-3 gap-3">{[["已发布", publishedCount, Send, "var(--app-success)", "var(--app-success-soft)"], ["待批改", pendingCount, Clock3, "var(--app-accent)", "var(--app-accent-soft)"], ["已批改", gradedCount, CheckCircle2, "var(--app-secondary)", "var(--app-secondary-soft)"]].map(([label, value, Icon, color, soft]) => { const MetricIcon = Icon as typeof Send; return <div key={String(label)} className="app-card rounded-2xl border p-4 text-center"><span className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: String(color), backgroundColor: String(soft) }}><MetricIcon size={17} /></span><p className="mt-2 text-2xl font-black">{String(value)}</p><p className="app-muted-text text-xs font-black">{String(label)}</p></div>; })}</div>
          </div>
        </section>

        {(assignmentsResult.error || submissionsResult.error || studentsResult.error) && <section className="rounded-2xl border p-4 text-sm font-bold" style={{ color: "var(--app-warm)", backgroundColor: "var(--app-warm-soft)", borderColor: "var(--app-warm)" }}>教学任务数据暂时无法读取，请确认最新数据库迁移已经执行。</section>}

        <section className="app-card rounded-3xl border p-4 sm:p-5">
          <div className="flex items-end justify-between gap-3"><div><h2 className="text-xl font-black">任务记录</h2><p className="app-muted-text mt-1 text-xs">共 {assignments.length} 个任务</p></div><ClipboardList size={22} style={{ color: "var(--app-accent)" }} /></div>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {assignments.map((assignment) => {
              const assignmentSubmissions = submissionsByAssignment.get(assignment.id) ?? [];
              const latestStudents = new Set(assignmentSubmissions.map((submission) => submission.student_id)).size;
              const waiting = assignmentSubmissions.filter((submission) => submission.status === "submitted").length;
              const tone = statusTones[assignment.status];
              return <article key={assignment.id} className="app-soft-card rounded-3xl border p-5"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: "var(--app-accent)", backgroundColor: "var(--app-accent-soft)" }}>{ASSIGNMENT_TYPE_LABELS[assignment.assignment_type]}</span><span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: tone.color, backgroundColor: tone.soft }}>{ASSIGNMENT_STATUS_LABELS[assignment.status]}</span><span className="app-muted-text ml-auto text-xs font-bold">{assignment.total_points} 分</span></div><h3 className="mt-4 text-lg font-black">{assignment.title}</h3><p className="app-muted-text mt-2 line-clamp-2 text-xs leading-5">{assignment.description || "暂未填写任务说明"}</p><div className="mt-4 grid grid-cols-3 gap-2"><div className="app-card rounded-xl border p-2.5 text-center"><p className="text-lg font-black">{latestStudents}</p><p className="app-muted-text text-[10px] font-bold">提交学生</p></div><div className="app-card rounded-xl border p-2.5 text-center"><p className="text-lg font-black">{waiting}</p><p className="app-muted-text text-[10px] font-bold">待批改</p></div><div className="app-card rounded-xl border p-2.5 text-center"><p className="truncate text-xs font-black">{assignment.course_id ? courseNames.get(assignment.course_id) ?? "关联课程" : "综合任务"}</p><p className="app-muted-text mt-1 text-[10px] font-bold">课程</p></div></div><div className="app-muted-text mt-4 flex flex-wrap items-center gap-3 text-xs"><span>截止：{formatAssignmentDate(assignment.due_at)}</span><span>{assignment.target_scope === "all_students" ? "全部学生" : "指定学生"}</span>{assignment.duration_minutes && <span>建议 {assignment.duration_minutes} 分钟</span>}</div><div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--app-border-soft)" }}><AssignmentStatusActions id={assignment.id} status={assignment.status} /><Link href={`/dashboard/admin/assignments/${assignment.id}`} className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black text-white" style={{ backgroundColor: "var(--app-secondary)" }}>查看与批改<ArrowRight size={13} /></Link></div></article>;
            })}
            {assignments.length === 0 && <div className="col-span-full rounded-3xl border border-dashed p-8 text-center"><ClipboardList className="mx-auto opacity-30" size={32} /><p className="mt-3 font-black">还没有教学任务</p><p className="app-muted-text mt-2 text-xs">使用下方表单布置第一份作业或考试。</p></div>}
          </div>
        </section>

        <AssignmentComposer courses={courses} students={students.map((student) => ({ id: student.id, name: student.full_name?.trim() || "未填写姓名", email: student.email || "未填写邮箱", tier: MEMBERSHIP_TIER_LABELS[normalizeMembershipTier(student.membership_tier)] }))} />

        <section className="app-soft-card flex items-start gap-3 rounded-2xl border p-4 text-xs leading-5 app-muted-text"><UsersRound className="mt-0.5 shrink-0" size={16} /><p>指定学生模式只向选中的学生开放任务；全部学生模式会自动覆盖当前和后续新增的正常学生账号。</p></section>
      </div>
    </div>
  );
}
