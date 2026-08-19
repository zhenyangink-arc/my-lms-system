import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { DashboardPageHeader } from "@/app/dashboard/DashboardPageHeader";
import {
  ASSIGNMENT_DATE_OPTIONS,
  ASSIGNMENT_STATUS_LABELS,
  type AssignmentStatus,
} from "@/app/dashboard/assignments/config";
import { LocalDateTime } from "@/components/LocalDateTime";
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
import { AssessmentPaperQuestionDrawer } from "./AssessmentPaperQuestionDrawer";
import { AssessmentPaperStatusActions } from "./AssessmentPaperStatusActions";
import { AssignmentStatusActions } from "./AssignmentStatusActions";

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
  allow_late_submission: boolean;
  max_attempts: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  grade_release_at: string | null;
  retake_paper_id: string | null;
};

type SubmissionRow = {
  assignment_id: string;
  student_id: string;
  status: string;
};

type AssignmentTargetRow = {
  assignment_id: string;
  student_id: string;
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
  draft: { color: "var(--foreground-muted)", soft: "var(--surface-soft)" },
  published: {
    color: "var(--status-success)",
    soft: "var(--status-success-surface)",
  },
  retired: {
    color: "var(--status-warning)",
    soft: "var(--status-warning-surface)",
  },
  archived: { color: "var(--foreground-muted)", soft: "var(--surface-soft)" },
} as const;

function AssignmentDate({ value }: { value: string | null }) {
  return (
    <LocalDateTime
      value={value}
      options={ASSIGNMENT_DATE_OPTIONS}
      fallback="时间待定"
    />
  );
}

export async function PaperTypeWorkspace({
  paperType,
  embedded = false,
}: {
  paperType: "homework" | "exam";
  embedded?: boolean;
}) {
  const access = await requireAssessmentPaperWorkspace();
  const { supabase, canManagePapers, canReleasePapers, canPublishPapers } = access;
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
      .from("chapter_tests")
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
  let bankQuestionReadError = false;
  if (canManagePapers) {
    const { data, error } = await supabase
      .from("chapter_test_questions")
      .select(
        "id,test_id,question_key,question_type,prompt,options,correct_option,correct_answer,explanation,skill,default_points,difficulty,tags,status,version,sort_order,updated_at"
      )
      .eq("status", "published")
      .order("sort_order", { ascending: true });
    bankQuestionReadError = Boolean(error);
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
  let assignmentTargets: AssignmentTargetRow[] = [];
  let courses: CourseRow[] = [];
  let students: StudentRow[] = [];
  let assignmentReadError = false;

  if (canPublishPapers) {
    const [
      assignmentsResult,
      submissionsResult,
      targetsResult,
      coursesResult,
      categoriesResult,
      studentsResult,
    ] = await Promise.all([
      supabase
        .from("learning_assignments")
        .select(
          "id,title,description,course_id,target_scope,total_points,starts_at,due_at,status,source_paper_code,source_paper_version,institution_note,allow_late_submission,max_attempts,shuffle_questions,shuffle_options,grade_release_at,retake_paper_id"
        )
        .eq("assignment_type", paperType)
        .order("created_at", { ascending: false }),
      supabase
        .from("learning_submissions")
        .select("assignment_id,student_id,status"),
      supabase
        .from("learning_assignment_targets")
        .select("assignment_id,student_id"),
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
    assignmentTargets = (targetsResult.data ?? []) as AssignmentTargetRow[];
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
        targetsResult.error ||
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
  const studentNameById = new Map(
    students.map((student) => [
      student.id,
      student.full_name?.trim() || student.email || "未填写姓名",
    ])
  );
  const targetsByAssignment = new Map<string, AssignmentTargetRow[]>();
  assignmentTargets.forEach((target) => {
    const current = targetsByAssignment.get(target.assignment_id) ?? [];
    current.push(target);
    targetsByAssignment.set(target.assignment_id, current);
  });

  const publishedPapers = papers.filter((paper) => paper.status === "published");
  const qualityByPaper = new Map<
    string,
    {
      snapshotMatches: boolean;
      allSkills: boolean;
      objectiveKeys: boolean;
      listeningReady: boolean;
      sourceCountsMatch: boolean;
      ready: boolean;
    }
  >();
  if (canPublishPapers) {
    const qualityResults = await Promise.all(
      publishedPapers.map(async (paper) => {
        const { data } = await supabase.rpc(
          "get_assessment_paper_release_quality",
          { p_paper_id: paper.id }
        );
        return [paper.id, data] as const;
      })
    );
    qualityResults.forEach(([paperId, quality]) => {
      if (quality && typeof quality === "object" && !Array.isArray(quality)) {
        qualityByPaper.set(paperId, quality as {
          snapshotMatches: boolean;
          allSkills: boolean;
          objectiveKeys: boolean;
          listeningReady: boolean;
          sourceCountsMatch: boolean;
          ready: boolean;
        });
      }
    });
  }

  const releasePapers: ReleasePaper[] = publishedPapers
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
        quality: qualityByPaper.get(paper.id) ?? {
          snapshotMatches: false,
          allSkills: false,
          objectiveKeys: false,
          listeningReady: false,
          sourceCountsMatch: false,
          ready: false,
        },
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
  const paperReadError = Boolean(
    paperResult.error || paperQuestionResult.error || groupResult.error
  );

  return (
    <div className={embedded ? "" : "pb-12"}>
      {!embedded && (
        <DashboardPageHeader
          title={`${typeLabel}管理`}
          description={
            canManagePapers
              ? `平台统一制作和管理标准${typeLabel}卷，机构只能整卷选择。`
              : `从平台标准${typeLabel}卷中选择整套试卷，安排学生和时间后发布。`
          }
          action={
            canManagePapers && !paperReadError && !bankQuestionReadError ? (
              <AssessmentPaperComposer
                paperType={paperType}
                canPublish={canReleasePapers}
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
      )}

      <div
        className={`mx-auto w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8 ${
          embedded ? "" : "mt-5"
        }`}
      >
        {!embedded && (
          <Link
            href="/dashboard/admin/assignments"
            className="app-muted-text inline-flex items-center gap-2 rounded-md text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--support)]"
          >
            <ArrowLeft aria-hidden="true" size={14} />
            返回作业考试管理
          </Link>
        )}

        <section className="border-y py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                {canManagePapers
                  ? `平台标准${typeLabel}卷`
                  : `机构${typeLabel}发布`}
              </h2>
            </div>
            <dl className="flex flex-wrap items-center gap-y-3 text-sm">
              {[
                [
                  canManagePapers ? "全部试卷" : "可选试卷",
                  paperReadError
                    ? "—"
                    : canManagePapers
                      ? papers.length
                      : publishedPaperCount,
                ],
                [
                  canManagePapers ? "机构可用" : "已发布",
                  paperReadError ||
                  (!canManagePapers && assignmentReadError)
                    ? "—"
                    : canManagePapers
                      ? publishedPaperCount
                      : activeAssignmentCount,
                ],
                [
                  canManagePapers ? "草稿" : "发布记录",
                  paperReadError ||
                  (!canManagePapers && assignmentReadError)
                    ? "—"
                    : canManagePapers
                      ? draftPaperCount
                      : assignments.length,
                ],
              ].map(([label, value], index) => (
                <div
                  key={String(label)}
                  className={`min-w-28 px-5 text-center ${index === 0 ? "" : "border-l"}`}
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <dd className="font-mono text-xl font-bold tabular-nums">
                    {String(value)}
                  </dd>
                  <dt className="app-muted-text mt-0.5 text-[11px]">
                    {String(label)}
                  </dt>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {paperReadError && (
          <section
            role="alert"
            aria-labelledby="paper-read-error"
            className="rounded-2xl border p-4 text-sm font-bold"
            style={{
              color: "var(--status-warning)",
              backgroundColor: "var(--status-warning-surface)",
              borderColor: "var(--status-warning)",
            }}
          >
            <h2 id="paper-read-error" className="text-sm font-semibold">
              标准试卷读取失败
            </h2>
            <p className="mt-1 font-normal">
              标准试卷暂时无法完整读取，请稍后刷新页面。
            </p>
          </section>
        )}

        {bankQuestionReadError && (
          <section
            role="alert"
            aria-labelledby="question-bank-read-error"
            className="rounded-2xl border p-4 text-sm"
            style={{
              color: "var(--status-warning)",
              backgroundColor: "var(--status-warning-surface)",
              borderColor: "var(--status-warning)",
            }}
          >
            <h2 id="question-bank-read-error" className="font-semibold">
              题库读取失败
            </h2>
            <p className="mt-1">
              暂时无法读取组卷题库。现有试卷仍可查看，但新增试卷入口已暂停，请稍后刷新页面。
            </p>
          </section>
        )}

        {assignmentReadError && (
          <section
            role="alert"
            aria-labelledby="assignment-read-error"
            className="rounded-2xl border p-4 text-sm"
            style={{
              color: "var(--status-warning)",
              backgroundColor: "var(--status-warning-surface)",
              borderColor: "var(--status-warning)",
            }}
          >
            <h2 id="assignment-read-error" className="font-semibold">
              发布记录读取失败
            </h2>
            <p className="mt-1">
              暂时无法读取机构课程、学生或发布记录。发布入口已暂停，请稍后刷新页面。
            </p>
          </section>
        )}

        {canManagePapers && !paperReadError && (
          <section
            className="border"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--card)",
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3.5">
              <div>
                <h2 className="text-sm font-semibold">标准{typeLabel}卷</h2>
                <p className="app-muted-text mt-0.5 text-[11px]">
                  共 {papers.length} 套
                </p>
              </div>
              {embedded && !bankQuestionReadError && (
              <AssessmentPaperComposer
                paperType={paperType}
                canPublish={canReleasePapers}
                  groups={groups.map((group) => ({
                    id: group.id,
                    title: group.title,
                    koreanTitle: group.korean_title,
                    chapterNumber: group.chapter_number,
                  }))}
                  questions={bankQuestions}
                />
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse text-left">
                <caption className="sr-only">
                  标准{typeLabel}卷列表，按更新时间由近到远排列
                </caption>
                <colgroup>
                  <col className="w-[17%]" />
                  <col className="w-[15%]" />
                  <col className="w-[10%]" />
                  <col className="w-[7%]" />
                  <col className="w-[8%]" />
                  <col className="w-[10%]" />
                  <col className="w-[6%]" />
                  <col className="w-[12%]" />
                  <col className="w-[15%]" />
                </colgroup>
                <thead
                  className="sticky top-0 z-20 backdrop-blur-xl"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--card) 84%, transparent)",
                  }}
                >
                  <tr className="border-b app-muted-text">
                    {[`${typeLabel}卷`, "来源章节", "题量 / 总分", "时长", "及格线", "状态", "版本", "更新时间", "操作"].map((label, index) => (
                      <th
                        key={label}
                        className={`${index > 0 ? "border-l" : ""} px-3 py-3 text-[11px] font-bold ${index >= 2 && index <= 7 ? "text-center" : index === 8 ? "text-right" : ""}`}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {papers.map((paper) => {
                    const group = groupById.get(paper.source_test_id);
                    const tone = paperStatusTones[paper.status];
                    const questions = questionsByPaper.get(paper.id) ?? [];
                    return (
                      <tr
                        key={paper.id}
                        className="border-b align-middle last:border-b-0 hover:bg-[var(--surface-soft)]"
                        style={{ borderColor: "var(--border-subtle)" }}
                      >
                        <td className="px-3 py-3.5">
                          <p className="text-sm font-bold">{paper.title}</p>
                          <p className="app-muted-text mt-0.5 font-mono text-[10px]">
                            {paper.paper_code}
                          </p>
                        </td>
                        <td className="border-l px-3 py-3.5 text-xs">
                          {group ? `第${group.chapter_number}章 · ${group.title}` : "综合题库"}
                        </td>
                        <td className="border-l px-3 py-3.5 text-center font-mono text-xs tabular-nums">
                          {paper.question_count} / {paper.total_points}
                        </td>
                        <td className="border-l px-3 py-3.5 text-center font-mono text-xs tabular-nums">
                          {paper.duration_minutes ?? "—"}
                        </td>
                        <td className="border-l px-3 py-3.5 text-center font-mono text-xs tabular-nums">
                          {paper.passing_score ?? "—"}
                        </td>
                        <td className="border-l px-3 py-3.5 text-center">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: tone.color }}>
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone.color }} />
                            {paperStatusLabels[paper.status]}
                          </span>
                        </td>
                        <td className="border-l px-3 py-3.5 text-center font-mono text-xs">
                          版本 {paper.version}
                        </td>
                        <td className="border-l px-3 py-3.5 text-center text-[11px]">
                          <AssignmentDate value={paper.updated_at} />
                        </td>
                        <td className="border-l px-3 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <AssessmentPaperQuestionDrawer
                              title={paper.title}
                              paperCode={paper.paper_code}
                              questions={questions.map((question) => ({
                                id: question.id,
                                prompt: question.prompt,
                                options: questionOptions(question.options),
                                points: Number(question.points),
                                difficulty: question.difficulty,
                                skill: question.skill,
                              }))}
                            />
                            <span className="app-muted-text">·</span>
                            <AssessmentPaperStatusActions
                              paperId={paper.id}
                              paperType={paperType}
                              status={paper.status}
                              canRelease={canReleasePapers}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {papers.length === 0 && (
                    <tr>
                      <td colSpan={9} className="app-muted-text px-5 py-12 text-center text-sm">
                        还没有标准{typeLabel}卷。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {canPublishPapers && !paperReadError && !assignmentReadError && (
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
              canTargetAllStudents={access.role !== "teacher"}
            />

            <section
              className="border"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--card)",
              }}
            >
              <div className="flex items-center justify-between gap-3 border-b px-4 py-3.5">
                <div>
                  <h2 className="text-sm font-semibold">本机构发布记录</h2>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed border-collapse text-left">
                  <caption className="sr-only">
                    本机构{typeLabel}发布记录，按创建时间由近到远排列
                  </caption>
                  <colgroup>
                    <col className="w-[17%]" />
                    <col className="w-[10%]" />
                    <col className="w-[12%]" />
                    <col className="w-[14%]" />
                    <col className="w-[15%]" />
                    <col className="w-[10%]" />
                    <col className="w-[8%]" />
                    <col className="w-[14%]" />
                  </colgroup>
                  <thead className="sticky top-0 z-20 backdrop-blur-xl" style={{ backgroundColor: "color-mix(in srgb, var(--card) 84%, transparent)" }}>
                    <tr className="border-b app-muted-text">
                      {["作业任务", "使用试卷", "关联课程", "指向学生", "开始 / 截止", "提交 / 待批改", "状态", "操作"].map((label, index) => (
                        <th key={label} className={`${index > 0 ? "border-l" : ""} px-3 py-3 text-[11px] font-bold ${index >= 3 && index <= 6 ? "text-center" : index === 7 ? "text-right" : ""}`}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((assignment) => {
                      const assignmentSubmissions = submissionsByAssignment.get(assignment.id) ?? [];
                      const submittedStudentIds = new Set(assignmentSubmissions.map((submission) => submission.student_id));
                      const submittedStudents = submittedStudentIds.size;
                      const waiting = assignmentSubmissions.filter((submission) => submission.status === "submitted").length;
                      const targets = targetsByAssignment.get(assignment.id) ?? [];
                      const expectedStudents = assignment.target_scope === "all_students"
                        ? students
                        : targets.map((target) => ({
                            id: target.student_id,
                            full_name: studentNameById.get(target.student_id) ?? "未知学生",
                            email: null,
                            membership_tier: null,
                          }));
                      const unsubmittedStudents = expectedStudents.filter(
                        (student) => !submittedStudentIds.has(student.id)
                      );
                      const targetLabel =
                        assignment.target_scope === "all_students"
                          ? "全部学生"
                          : targets.length === 0
                            ? "未找到学生"
                            : targets.length <= 2
                              ? targets.map((target) => studentNameById.get(target.student_id) ?? "未知学生").join("、")
                              : `${targets.map((target) => studentNameById.get(target.student_id) ?? "未知学生").slice(0, 2).join("、")} 等 ${targets.length} 人`;
                      return (
                        <tr key={assignment.id} className="border-b align-middle last:border-b-0 hover:bg-[var(--surface-soft)]" style={{ borderColor: "var(--border-subtle)" }}>
                          <td className="px-3 py-3.5">
                            <p className="text-sm font-bold">{assignment.title}</p>
                            <p className="app-muted-text mt-0.5 text-[10px]">{assignment.total_points} 分</p>
                          </td>
                          <td className="border-l px-3 py-3.5 font-mono text-[11px]">
                            {assignment.source_paper_code ?? "历史任务"} · 版本 {assignment.source_paper_version ?? 1}
                          </td>
                          <td className="border-l px-3 py-3.5 text-xs">
                            {assignment.course_id ? courseNameById.get(assignment.course_id) ?? "关联课程" : "未关联课程"}
                          </td>
                          <td className="border-l px-3 py-3.5 text-center text-xs">
                            <span title={targetLabel}>{targetLabel}</span>
                          </td>
                          <td className="border-l px-3 py-3.5 text-center text-[11px] leading-5">
                            <p><AssignmentDate value={assignment.starts_at} /></p>
                            <p className="app-muted-text"><AssignmentDate value={assignment.due_at} /></p>
                          </td>
                          <td className="border-l px-3 py-3.5 text-center font-mono text-xs tabular-nums">
                            <p>{submittedStudents} / {waiting}</p>
                            <details className="mt-1 font-sans text-[11px]">
                              <summary className="cursor-pointer font-bold text-[var(--support)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
                                未提交 {unsubmittedStudents.length} 人
                              </summary>
                              <ul className="mt-2 max-h-32 space-y-1 overflow-auto text-left app-muted-text">
                                {unsubmittedStudents.map((student) => (
                                  <li key={student.id}>
                                    {student.full_name?.trim() || student.email || "未填写姓名"}
                                  </li>
                                ))}
                                {unsubmittedStudents.length === 0 && (
                                  <li>当前名单已全部提交</li>
                                )}
                              </ul>
                            </details>
                          </td>
                          <td className="border-l px-3 py-3.5 text-center text-[11px] font-bold">
                            {ASSIGNMENT_STATUS_LABELS[assignment.status]}
                          </td>
                          <td className="border-l px-3 py-3.5">
                            <div className="flex items-center justify-end gap-2">
                              <AssignmentStatusActions id={assignment.id} status={assignment.status} />
                              <Link href={`/dashboard/admin/assignments/${assignment.id}`} className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--support)] hover:underline">
                                查看与批改
                                <ArrowRight aria-hidden="true" size={12} />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {assignments.length === 0 && (
                      <tr>
                        <td colSpan={8} className="app-muted-text px-5 py-12 text-center text-sm">
                          还没有发布记录，从上方选择一套完整试卷即可发布。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

      </div>
    </div>
  );
}
