import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  ClipboardList,
  Clock3,
  FileText,
  Layers3,
  Send,
  ShieldCheck,
} from "lucide-react";

import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";
import {
  ASSIGNMENT_STATUS_LABELS,
  formatAssignmentDate,
  type AssignmentStatus,
} from "@/app/dashboard/assignments/config";
import { requireAssessmentPaperWorkspace } from "@/lib/assessment-papers";
import {
  questionOptions,
  type StandardQuestion,
  type StandardQuestionGroup,
} from "@/lib/question-bank";
import {
  MEMBERSHIP_TIER_LABELS,
  normalizeMembershipTier,
} from "@/lib/student-permissions";
import {
  AssessmentPaperComposer,
  type PaperBankQuestion,
} from "./AssessmentPaperComposer";
import {
  AssessmentPaperReleaseCatalog,
  type ReleasePaper,
  type ReleasePaperQuestion,
} from "./AssessmentPaperReleaseCatalog";
import { AssessmentPaperStatusActions } from "./AssessmentPaperStatusActions";
import { AssignmentStatusActions } from "./AssignmentStatusActions";
import { DashboardTitleWithHint } from "@/app/dashboard/DashboardTitleWithHint";

type PaperRow = {
  id: string;
  paper_code: string;
  paper_type: "homework" | "exam";
  title: string;
  description: string;
  source_test_id: string;
  duration_minutes: number | null;
  passing_score: number | null;
  allow_resubmission: boolean;
  total_points: number;
  question_count: number;
  version: number;
  status: "draft" | "published" | "retired" | "archived";
  updated_at: string;
};

type PaperQuestionRow = {
  id: string;
  paper_id: string;
  prompt: string;
  options: unknown;
  points: number;
  sort_order: number;
  difficulty: string;
  skill: string;
};

type AssignmentRow = {
  id: string;
  title: string;
  description: string;
  course_id: string | null;
  target_scope: string;
  total_points: number;
  starts_at: string;
  due_at: string;
  status: AssignmentStatus;
  source_paper_code: string | null;
  source_paper_version: number | null;
  institution_note: string;
};

type SubmissionRow = {
  assignment_id: string;
  student_id: string;
  status: string;
};

type CourseRow = {
  id: string;
  title: string;
  slug: string;
  category_id: string | null;
};
type CategoryRow = {
  id: string;
  parent_id: string | null;
  slug: string;
};
type StudentRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  membership_tier: string | null;
};

const paperStatusLabels = {
  draft: "草稿",
  published: "机构可用",
  retired: "已停止提供",
  archived: "已归档",
} as const;

const paperStatusTones = {
  draft: { color: "var(--app-muted)", soft: "var(--app-soft-bg)" },
  published: {
    color: "var(--app-success)",
    soft: "var(--app-success-soft)",
  },
  retired: { color: "var(--app-warm)", soft: "var(--app-warm-soft)" },
  archived: { color: "var(--app-muted)", soft: "var(--app-soft-bg)" },
} as const;

export async function PaperTypeWorkspace({
  paperType,
}: {
  paperType: "homework" | "exam";
}) {
  const access = await requireAssessmentPaperWorkspace();
  const { supabase, canManagePapers, canPublishPapers } = access;
  const typeLabel = paperType === "homework" ? "作业" : "考试";

  const [paperResult, paperQuestionResult, groupResult] = await Promise.all([
    supabase
      .from("assessment_papers")
      .select(
        "id,paper_code,paper_type,title,description,source_test_id,duration_minutes,passing_score,allow_resubmission,total_points,question_count,version,status,updated_at"
      )
      .eq("paper_type", paperType)
      .order("updated_at", { ascending: false }),
    supabase
      .from("assessment_paper_questions")
      .select(
        "id,paper_id,prompt,options,points,sort_order,difficulty,skill"
      )
      .order("sort_order", { ascending: true }),
    supabase
      .from("course_tests")
      .select("id,lesson_id,slug,course_key,chapter_number,title,korean_title,status")
      .eq("status", "published")
      .order("chapter_number", { ascending: true }),
  ]);

  const papers = (paperResult.data ?? []) as PaperRow[];
  const paperQuestions = (paperQuestionResult.data ?? []) as PaperQuestionRow[];
  const groups = (groupResult.data ?? []) as StandardQuestionGroup[];
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const questionsByPaper = new Map<string, PaperQuestionRow[]>();
  paperQuestions.forEach((question) => {
    const current = questionsByPaper.get(question.paper_id) ?? [];
    current.push(question);
    questionsByPaper.set(question.paper_id, current);
  });

  let bankQuestions: PaperBankQuestion[] = [];
  if (canManagePapers) {
    const { data } = await supabase
      .from("course_test_questions")
      .select(
        "id,test_id,question_key,question_type,prompt,options,correct_option,correct_answer,explanation,skill,default_points,difficulty,tags,status,version,sort_order,updated_at"
      )
      .eq("status", "published")
      .order("sort_order", { ascending: true });
    bankQuestions = ((data ?? []) as StandardQuestion[]).map((question) => ({
      id: question.id,
      groupId: question.test_id,
      prompt: question.prompt,
      questionType: question.question_type,
      options: questionOptions(question.options),
      difficulty: question.difficulty,
      skill: question.skill,
      defaultPoints: Number(question.default_points),
    }));
  }

  let assignments: AssignmentRow[] = [];
  let submissions: SubmissionRow[] = [];
  let courses: CourseRow[] = [];
  let students: StudentRow[] = [];
  let assignmentReadError = false;

  if (canPublishPapers) {
    const [
      assignmentsResult,
      submissionsResult,
      coursesResult,
      categoriesResult,
      studentsResult,
    ] = await Promise.all([
      supabase
        .from("learning_assignments")
        .select(
          "id,title,description,course_id,target_scope,total_points,starts_at,due_at,status,source_paper_code,source_paper_version,institution_note"
        )
        .eq("assignment_type", paperType)
        .order("created_at", { ascending: false }),
      supabase
        .from("learning_submissions")
        .select("assignment_id,student_id,status"),
      supabase
        .from("courses")
        .select("id,title,slug,category_id")
        .eq("is_published", true)
        .order("title", { ascending: true }),
      supabase
        .from("course_categories")
        .select("id,parent_id,slug"),
      supabase.rpc("list_learning_assignment_students"),
    ]);
    assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
    submissions = (submissionsResult.data ?? []) as SubmissionRow[];
    students = (studentsResult.data ?? []) as StudentRow[];

    const allCourses = (coursesResult.data ?? []) as CourseRow[];
    const categories = (categoriesResult.data ?? []) as CategoryRow[];
    const categoryById = new Map(
      categories.map((category) => [category.id, category])
    );
    courses = allCourses.filter((course) => {
      const child = course.category_id
        ? categoryById.get(course.category_id)
        : undefined;
      const parent = child?.parent_id
        ? categoryById.get(child.parent_id)
        : child;
      return (
        parent?.slug !== "service" &&
        child?.slug !== "service" &&
        !course.slug.startsWith("service-")
      );
    });
    assignmentReadError = Boolean(
      assignmentsResult.error ||
        submissionsResult.error ||
        coursesResult.error ||
        categoriesResult.error ||
        studentsResult.error
    );
  }

  const publishedPaperCount = papers.filter(
    (paper) => paper.status === "published"
  ).length;
  const draftPaperCount = papers.filter(
    (paper) => paper.status === "draft"
  ).length;
  const activeAssignmentCount = assignments.filter(
    (assignment) => assignment.status === "published"
  ).length;
  const submissionsByAssignment = new Map<string, SubmissionRow[]>();
  submissions.forEach((submission) => {
    const current =
      submissionsByAssignment.get(submission.assignment_id) ?? [];
    current.push(submission);
    submissionsByAssignment.set(submission.assignment_id, current);
  });
  const courseNameById = new Map(courses.map((course) => [course.id, course.title]));

  const releasePapers: ReleasePaper[] = papers
    .filter((paper) => paper.status === "published")
    .map((paper) => {
      const group = groupById.get(paper.source_test_id);
      return {
        id: paper.id,
        paperCode: paper.paper_code,
        title: paper.title,
        description: paper.description,
        chapterTitle: group?.title ?? "综合题库",
        chapterNumber: group?.chapter_number ?? 0,
        durationMinutes: paper.duration_minutes,
        passingScore:
          paper.passing_score == null ? null : Number(paper.passing_score),
        allowResubmission: paper.allow_resubmission,
        totalPoints: Number(paper.total_points),
        questionCount: paper.question_count,
        version: paper.version,
      };
    });
  const releaseQuestions: ReleasePaperQuestion[] = paperQuestions.map(
    (question) => ({
      id: question.id,
      paperId: question.paper_id,
      prompt: question.prompt,
      options: questionOptions(question.options),
      points: Number(question.points),
      sortOrder: question.sort_order,
    })
  );

  return (
    <div className="pb-12">
      <DashboardPageHeader
        title={`${typeLabel}管理`}
        description={
          canManagePapers
            ? `平台统一制作和管理标准${typeLabel}卷，机构只能整卷选择。`
            : `从平台标准${typeLabel}卷中选择整套试卷，安排学生和时间后发布。`
        }
        action={
          canManagePapers ? (
            <AssessmentPaperComposer
              paperType={paperType}
              groups={groups.map((group) => ({
                id: group.id,
                title: group.title,
                koreanTitle: group.korean_title,
                chapterNumber: group.chapter_number,
              }))}
              questions={bankQuestions}
            />
          ) : undefined
        }
      />

      <div className="mx-auto mt-5 w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/admin/assignments"
          className="app-muted-text inline-flex items-center gap-2 text-xs font-black"
        >
          <ArrowLeft size={14} />
          返回作业考试管理
        </Link>

        <section
          className="app-card overflow-hidden rounded-3xl border p-5 sm:p-6"
          style={{
            background:
              "linear-gradient(125deg, var(--app-card-bg), var(--app-hero-start), var(--app-accent-soft))",
          }}
        >
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-end">
            <div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
                style={{
                  color: "var(--app-accent)",
                  backgroundColor: "var(--app-accent-soft)",
                }}
              >
                <ShieldCheck size={15} />
                {canManagePapers ? "平台标准试卷工作台" : "机构整卷发布工作台"}
              </span>
              <h2 className="mt-3 text-2xl font-black tracking-tight">
                {canManagePapers
                  ? `${typeLabel}卷可以持续新增，不限制为 A—E`
                  : `机构只能选择完整${typeLabel}卷，不能接触标准题库`}
              </h2>
              <p className="app-muted-text mt-2 max-w-2xl text-sm leading-6">
                {canManagePapers
                  ? "试卷发布后会作为固定版本提供给机构；停止提供只阻止新发布，不影响既有学生任务。"
                  : "预览用于核对题目，发布时只能设置本机构课程、学生范围、开始时间、截止时间和补充通知。"}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                [
                  canManagePapers ? "机构可用" : "可选试卷",
                  publishedPaperCount,
                  Send,
                ],
                [
                  canManagePapers ? "试卷草稿" : "已发布",
                  canManagePapers ? draftPaperCount : activeAssignmentCount,
                  Clock3,
                ],
                [
                  canManagePapers ? "全部试卷" : "发布记录",
                  canManagePapers ? papers.length : assignments.length,
                  Layers3,
                ],
              ].map(([label, value, Icon]) => {
                const MetricIcon = Icon as typeof Send;
                return (
                  <div
                    key={String(label)}
                    className="app-card rounded-2xl border p-4 text-center"
                  >
                    <MetricIcon
                      className="mx-auto"
                      size={17}
                      style={{ color: "var(--app-accent)" }}
                    />
                    <p className="mt-2 text-2xl font-black">{String(value)}</p>
                    <p className="app-muted-text text-[11px] font-black">
                      {String(label)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {(paperResult.error ||
          paperQuestionResult.error ||
          groupResult.error ||
          assignmentReadError) && (
          <section
            className="rounded-2xl border p-4 text-sm font-bold"
            style={{
              color: "var(--app-warm)",
              backgroundColor: "var(--app-warm-soft)",
              borderColor: "var(--app-warm)",
            }}
          >
            标准试卷数据暂时无法完整读取，请确认最新数据库迁移已经执行。
          </section>
        )}

        {canManagePapers && (
          <section className="app-card rounded-3xl border p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <DashboardTitleWithHint headingLevel={2} titleClassName="text-xl font-black" title={<>标准{typeLabel}卷</>} description={<>共 {papers.length} 套；点击试卷内容可展开或收起。</>} />
              </div>
              <BookOpenCheck
                size={22}
                style={{ color: "var(--app-accent)" }}
              />
            </div>
            <div className="mt-5 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
              {papers.map((paper) => {
                const group = groupById.get(paper.source_test_id);
                const tone = paperStatusTones[paper.status];
                const questions = questionsByPaper.get(paper.id) ?? [];
                return (
                  <article
                    key={paper.id}
                    className="app-soft-card rounded-3xl border p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-black"
                        style={{
                          color: "var(--app-accent)",
                          backgroundColor: "var(--app-accent-soft)",
                        }}
                      >
                        {paper.paper_code}
                      </span>
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-black"
                        style={{
                          color: tone.color,
                          backgroundColor: tone.soft,
                        }}
                      >
                        {paperStatusLabels[paper.status]}
                      </span>
                      <span className="app-muted-text ml-auto text-[10px] font-black">
                        v{paper.version}
                      </span>
                    </div>
                    <h3 className="mt-4 text-lg font-black">{paper.title}</h3>
                    <p className="app-muted-text mt-1 text-xs">
                      {group
                        ? `第${group.chapter_number}章 · ${group.title}`
                        : "综合题库"}
                    </p>
                    <p className="app-muted-text mt-3 line-clamp-2 text-xs leading-5">
                      {paper.description || "暂未填写试卷说明。"}
                    </p>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="app-card rounded-xl border p-2 text-center">
                        <p className="font-black">{paper.question_count}</p>
                        <p className="app-muted-text text-[10px]">题目</p>
                      </div>
                      <div className="app-card rounded-xl border p-2 text-center">
                        <p className="font-black">{paper.total_points}</p>
                        <p className="app-muted-text text-[10px]">总分</p>
                      </div>
                      <div className="app-card rounded-xl border p-2 text-center">
                        <p className="font-black">
                          {paper.duration_minutes ?? "—"}
                        </p>
                        <p className="app-muted-text text-[10px]">分钟</p>
                      </div>
                    </div>
                    <details className="mt-4 rounded-2xl border">
                      <summary className="cursor-pointer list-none px-4 py-3 text-xs font-black">
                        查看完整试卷内容
                      </summary>
                      <div className="space-y-3 border-t p-3" style={{ borderColor: "var(--app-border-soft)" }}>
                        {questions.map((question, index) => (
                          <div
                            key={question.id}
                            className="app-card rounded-xl border p-3"
                          >
                            <div className="flex justify-between gap-3 text-[10px] font-black">
                              <span>第 {index + 1} 题</span>
                              <span style={{ color: "var(--app-secondary)" }}>
                                {question.points} 分
                              </span>
                            </div>
                            <p className="mt-2 text-xs font-bold leading-5">
                              {question.prompt}
                            </p>
                          </div>
                        ))}
                      </div>
                    </details>
                    <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--app-border-soft)" }}>
                      <AssessmentPaperStatusActions
                        paperId={paper.id}
                        paperType={paperType}
                        status={paper.status}
                      />
                    </div>
                  </article>
                );
              })}
              {papers.length === 0 && (
                <div className="app-muted-text col-span-full rounded-3xl border border-dashed p-10 text-center text-sm">
                  还没有标准{typeLabel}卷，点击右上角开始新增。
                </div>
              )}
            </div>
          </section>
        )}

        {canPublishPapers && (
          <>
            <AssessmentPaperReleaseCatalog
              paperType={paperType}
              papers={releasePapers}
              questions={releaseQuestions}
              courses={courses.map((course) => ({
                id: course.id,
                title: course.title,
              }))}
              students={students.map((student) => ({
                id: student.id,
                name: student.full_name?.trim() || "未填写姓名",
                email: student.email || "未填写邮箱",
                tier:
                  MEMBERSHIP_TIER_LABELS[
                    normalizeMembershipTier(student.membership_tier)
                  ],
              }))}
            />

            <section className="app-card rounded-3xl border p-4 sm:p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <DashboardTitleWithHint headingLevel={2} titleClassName="text-xl font-black" title={<>本机构发布记录</>} description={<>共 {assignments.length} 个{typeLabel}任务</>} />
                </div>
                <ClipboardList
                  size={22}
                  style={{ color: "var(--app-accent)" }}
                />
              </div>
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {assignments.map((assignment) => {
                  const assignmentSubmissions =
                    submissionsByAssignment.get(assignment.id) ?? [];
                  const submittedStudents = new Set(
                    assignmentSubmissions.map(
                      (submission) => submission.student_id
                    )
                  ).size;
                  const waiting = assignmentSubmissions.filter(
                    (submission) => submission.status === "submitted"
                  ).length;
                  return (
                    <article
                      key={assignment.id}
                      className="app-soft-card rounded-3xl border p-5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-full px-2.5 py-1 text-[10px] font-black"
                          style={{
                            color: "var(--app-accent)",
                            backgroundColor: "var(--app-accent-soft)",
                          }}
                        >
                          {assignment.source_paper_code ?? "历史任务"} · v
                          {assignment.source_paper_version ?? 1}
                        </span>
                        <span
                          className="rounded-full px-2.5 py-1 text-[10px] font-black"
                          style={{
                            color:
                              assignment.status === "published"
                                ? "var(--app-success)"
                                : "var(--app-muted)",
                            backgroundColor:
                              assignment.status === "published"
                                ? "var(--app-success-soft)"
                                : "var(--app-soft-bg)",
                          }}
                        >
                          {ASSIGNMENT_STATUS_LABELS[assignment.status]}
                        </span>
                      </div>
                      <h3 className="mt-4 text-lg font-black">
                        {assignment.title}
                      </h3>
                      <p className="app-muted-text mt-2 text-xs">
                        {assignment.course_id
                          ? courseNameById.get(assignment.course_id) ??
                            "关联课程"
                          : "未关联具体课程"}
                      </p>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {[
                          ["提交学生", submittedStudents],
                          ["待批改", waiting],
                          ["总分", assignment.total_points],
                        ].map(([label, value]) => (
                          <div
                            key={String(label)}
                            className="app-card rounded-xl border p-2.5 text-center"
                          >
                            <p className="text-lg font-black">
                              {String(value)}
                            </p>
                            <p className="app-muted-text text-[10px]">
                              {String(label)}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="app-muted-text mt-4 space-y-1 text-xs">
                        <p>开始：{formatAssignmentDate(assignment.starts_at)}</p>
                        <p>截止：{formatAssignmentDate(assignment.due_at)}</p>
                      </div>
                      <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--app-border-soft)" }}>
                        <AssignmentStatusActions
                          id={assignment.id}
                          status={assignment.status}
                        />
                        <Link
                          href={`/dashboard/admin/assignments/${assignment.id}`}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black text-white"
                          style={{ backgroundColor: "var(--app-secondary)" }}
                        >
                          查看与批改
                          <ArrowRight size={13} />
                        </Link>
                      </div>
                    </article>
                  );
                })}
                {assignments.length === 0 && (
                  <div className="app-muted-text col-span-full rounded-3xl border border-dashed p-10 text-center text-sm">
                    还没有发布记录，从上方选择一套完整试卷即可发布。
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        <section className="app-soft-card flex items-start gap-3 rounded-2xl border p-4 text-xs leading-5 app-muted-text">
          <FileText className="mt-0.5 shrink-0" size={16} />
          <p>
            标准题库只对平台试卷管理员开放。机构端只能查看平台已经发布的完整试卷，并创建不可编辑的发布快照。
          </p>
        </section>
      </div>
    </div>
  );
}
