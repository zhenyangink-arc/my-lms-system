import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { requireAssignmentViewer } from "@/lib/learning-assignments";
import {
  getUnlockedKoreanTestSlugs,
  isKoreanChapterLearningCompleted,
  KOREAN_TEST_SEQUENCE,
} from "@/lib/korean-learning-unlocks";
import type { CourseTestRow } from "@/lib/korean-chapter-tests";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getStudentAppCourseScope,
  withStudentAppSchemaFallback,
} from "@/lib/student-app-data";
import { STUDENT_APP_IDS } from "@/lib/student-apps";
import {
  type AssignmentType,
  type SubmissionWorkflowState,
} from "./config";
import {
  AssignmentBoard,
  type TaskTypeFilter,
} from "./AssignmentBoard";

type AssignmentRow = {
  id: string;
  title: string;
  description: string;
  assignment_type: AssignmentType;
  course_id: string | null;
  total_points: number;
  starts_at: string;
  due_at: string;
  duration_minutes: number | null;
  allow_resubmission: boolean;
  unlock_after_chapter_completion: boolean;
  unlock_test_slug: string | null;
  due_days_after_unlock: number | null;
};

type SubmissionRow = {
  id: string;
  assignment_id: string;
  attempt_number: number;
  submission_state: SubmissionWorkflowState;
  score: number | null;
  overall_feedback: string | null;
  submitted_at: string;
};

type AssignmentProgressRow = {
  assignment_id: string;
  progress_state: SubmissionWorkflowState | "in_progress";
  latest_submission_id: string | null;
  attempts_used: number;
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
  title: string;
};

type ChapterTestAttemptRow = {
  test_slug: string;
  score: number;
  passed: boolean;
  attempted_at: string;
};

type EbookProgressRow = {
  test_slug: string;
  progress_percent: number;
  reading_seconds: number;
  read_pages: number[];
  total_pages: number;
  completion_source: string | null;
  completed_at: string | null;
};

function getLatestSubmissions(submissions: SubmissionRow[]) {
  const latest = new Map<string, SubmissionRow>();

  for (const submission of submissions) {
    const current = latest.get(submission.assignment_id);
    if (!current || submission.attempt_number > current.attempt_number) {
      latest.set(submission.assignment_id, submission);
    }
  }

  return latest;
}

function normalizeTaskTypeFilter(value: string | string[] | undefined): TaskTypeFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate === "chapter_test" ||
    candidate === "homework" ||
    candidate === "exam"
    ? candidate
    : "all";
}

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = searchParams ? await searchParams : {};
  const initialTaskTypeFilter = normalizeTaskTypeFilter(query.type);
  const { supabase, user, tenant, isManager } = await requireAssignmentViewer();
  if (!isManager) {
    await supabase.rpc("release_current_user_due_assignment_grades");
  }
  const admin = createAdminClient();
  const koreanScope = await getStudentAppCourseScope(supabase, "korean");
  // Request-time snapshot keeps all deadline labels consistent for this render.
  // eslint-disable-next-line react-hooks/purity
  const currentTime = Date.now();

  const [
    assignmentsResult,
    submissionsResult,
    coursesResult,
    categoriesResult,
    chapterTestsResult,
    chapterQuestionsResult,
    ebookProgressResult,
    assignmentProgressResult,
  ] =
    await Promise.all([
      withStudentAppSchemaFallback(
        supabase
          .from("learning_assignments")
          .select(
            "id,title,description,assignment_type,course_id,total_points,starts_at,due_at,duration_minutes,allow_resubmission,unlock_after_chapter_completion,unlock_test_slug,due_days_after_unlock"
          )
          .eq("student_app_id", STUDENT_APP_IDS.korean)
          .eq("status", "published")
          .order("due_at", { ascending: true }),
        () =>
          supabase
            .from("learning_assignments")
            .select(
              "id,title,description,assignment_type,course_id,total_points,starts_at,due_at,duration_minutes,allow_resubmission,unlock_after_chapter_completion,unlock_test_slug,due_days_after_unlock"
            )
            .eq("status", "published")
            .order("due_at", { ascending: true }),
      ),
      isManager
        ? Promise.resolve({ data: [] as SubmissionRow[], error: null })
        : supabase
            .from("student_learning_submissions")
            .select(
              "id,assignment_id,attempt_number,submission_state,score,overall_feedback,submitted_at"
            )
            .eq("student_id", user.id)
            .order("attempt_number", { ascending: false }),
      supabase.from("courses").select("id,title,slug,category_id"),
      supabase
        .from("course_categories")
        .select("id,parent_id,slug,title"),
      withStudentAppSchemaFallback(
        admin
          .from("chapter_tests")
          .select(
            "id,lesson_id,slug,course_key,chapter_number,title,korean_title,description,duration_minutes,passing_score,skills,version,status"
          )
          .eq("student_app_id", STUDENT_APP_IDS.korean)
          .in("course_key", ["hangul-introduction", "korean-level-one"])
          .eq("status", "published")
          .order("chapter_number", { ascending: true }),
        () =>
          admin
            .from("chapter_tests")
            .select(
              "id,lesson_id,slug,course_key,chapter_number,title,korean_title,description,duration_minutes,passing_score,skills,version,status"
            )
            .in("course_key", ["hangul-introduction", "korean-level-one"])
            .eq("status", "published")
            .order("chapter_number", { ascending: true }),
      ),
      admin
        .from("chapter_test_questions")
        .select("test_id")
        .eq("status", "published")
        .eq("question_type", "single_choice")
        .eq("is_chapter_test_item", true),
      withStudentAppSchemaFallback(
        admin
          .from("course_ebook_progress")
          .select("test_slug,progress_percent,reading_seconds,read_pages,total_pages,completion_source,completed_at")
          .eq("student_id", user.id)
          .eq("tenant_id", tenant?.id ?? "")
          .eq("student_app_id", STUDENT_APP_IDS.korean),
        () =>
          admin
            .from("course_ebook_progress")
            .select("test_slug,progress_percent,reading_seconds,read_pages,total_pages,completion_source,completed_at")
            .eq("student_id", user.id)
            .eq("tenant_id", tenant?.id ?? ""),
      ),
      isManager
        ? Promise.resolve({ data: [] as AssignmentProgressRow[], error: null })
        : supabase
            .from("learning_assignment_progress")
            .select("assignment_id,progress_state,latest_submission_id,attempts_used")
            .eq("student_id", user.id),
    ]);

  const allAssignments = (assignmentsResult.data ?? []) as AssignmentRow[];
  const submissions = (submissionsResult.data ?? []) as SubmissionRow[];
  const assignmentProgress = (assignmentProgressResult.data ?? []) as AssignmentProgressRow[];
  const courses = (coursesResult.data ?? []) as CourseRow[];
  const categories = (categoriesResult.data ?? []) as CategoryRow[];
  const allChapterTests = (chapterTestsResult.data ?? []) as CourseTestRow[];
  const ebookProgressBySlug = new Map(
    ((ebookProgressResult.data ?? []) as EbookProgressRow[]).map((progress) => [
      progress.test_slug,
      progress,
    ]),
  );
  const completedLearningSlugs = [...ebookProgressBySlug.entries()]
    .filter(([, progress]) =>
      isKoreanChapterLearningCompleted({
        progressPercent: progress.progress_percent,
        readingSeconds: progress.reading_seconds,
        readPages: progress.read_pages,
        totalPages: progress.total_pages,
        completionSource: progress.completion_source,
      })
    )
    .map(([slug]) => slug);

  const { data: chapterAttemptData, error: chapterAttemptError } = allChapterTests.length
    ? await admin
        .from("chapter_test_attempts")
        .select("test_slug,score,passed,attempted_at")
        .eq("student_id", user.id)
        .eq("tenant_id", tenant?.id ?? "")
        .in(
          "test_slug",
          allChapterTests.map((test) => test.slug)
        )
        .order("attempted_at", { ascending: false })
    : { data: [] as ChapterTestAttemptRow[] };

  const latestAttemptBySlug = new Map<string, ChapterTestAttemptRow>();
  const passedAttemptBySlug = new Map<string, ChapterTestAttemptRow>();
  for (const attempt of (chapterAttemptData ?? []) as ChapterTestAttemptRow[]) {
    if (!latestAttemptBySlug.has(attempt.test_slug)) {
      latestAttemptBySlug.set(attempt.test_slug, attempt);
    }
    if (attempt.passed && !passedAttemptBySlug.has(attempt.test_slug)) {
      passedAttemptBySlug.set(attempt.test_slug, attempt);
    }
  }
  const unlockedTestSlugs = getUnlockedKoreanTestSlugs(
    passedAttemptBySlug.keys(),
    completedLearningSlugs,
  );
  const questionCountByTestId = new Map<string, number>();
  for (const question of chapterQuestionsResult.data ?? []) {
    const testId = String(question.test_id);
    questionCountByTestId.set(testId, (questionCountByTestId.get(testId) ?? 0) + 1);
  }

  const testBySlug = new Map(allChapterTests.map((test) => [test.slug, test]));

  const visibleTestSlugs = new Set(unlockedTestSlugs);
  const lastUnlockedIndex = KOREAN_TEST_SEQUENCE.reduce(
    (latestIndex, slug, index) =>
      unlockedTestSlugs.has(slug) ? index : latestIndex,
    -1
  );
  const nextLockedSlug = KOREAN_TEST_SEQUENCE[lastUnlockedIndex + 1];
  if (nextLockedSlug) visibleTestSlugs.add(nextLockedSlug);

  const chapterTests = allChapterTests
    .filter((test) => visibleTestSlugs.has(test.slug))
    .map((test) => {
      const unlocked = unlockedTestSlugs.has(test.slug);
      const attempt =
        passedAttemptBySlug.get(test.slug) ?? latestAttemptBySlug.get(test.slug);
      const sequenceIndex = KOREAN_TEST_SEQUENCE.indexOf(
        test.slug as (typeof KOREAN_TEST_SEQUENCE)[number]
      );
      const prerequisite =
        sequenceIndex > 0
          ? testBySlug.get(KOREAN_TEST_SEQUENCE[sequenceIndex - 1])
          : null;
      const prerequisitePassed =
        sequenceIndex <= 0 ||
        passedAttemptBySlug.has(KOREAN_TEST_SEQUENCE[sequenceIndex - 1]);
      const chapterLearningCompleted = completedLearningSlugs.includes(test.slug);
      const ebookProgressPercent = Math.min(
        100,
        Math.max(
          0,
          Number(ebookProgressBySlug.get(test.slug)?.progress_percent) || 0,
        ),
      );
      const unlockRequirement = !unlocked
        ? !chapterLearningCompleted && !prerequisitePassed && prerequisite
          ? `先通过上一章「${prerequisite.title}」的测试，并完成本章电子书或智能教材后解锁`
          : !chapterLearningCompleted
            ? "完成本章电子书或智能教材后解锁"
            : prerequisite
              ? `通过上一章「${prerequisite.title}」的章节测试后解锁`
              : "完成本章学习后解锁"
        : null;
      return {
        id: test.id,
        slug: test.slug,
        title: test.title,
        koreanTitle: test.korean_title,
        description: test.description,
        chapterNumber: test.chapter_number,
        courseTitle:
          test.course_key === "hangul-introduction" ? "韩语字母入门" : "韩国语 1级",
        courseGroup: "韩语课程",
        durationMinutes: test.duration_minutes,
        passingScore: test.passing_score,
        questionCount: questionCountByTestId.get(test.id) ?? 0,
        unlocked,
        ebookProgressPercent,
        unlockRequirement,
        studyHref:
          `/dashboard/courses/korean/korean-basic/korean-beginner/${
            test.course_key === "hangul-introduction"
              ? "hangul-introduction"
              : "basic-pronunciation"
          }?chapter=${encodeURIComponent(test.slug)}`,
        attempt: unlocked && attempt
          ? { score: attempt.score, passed: attempt.passed }
          : null,
      };
    });

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const courseById = new Map(courses.map((course) => [course.id, course]));

  const isStudyAbroadServiceCourse = (course: CourseRow) => {
    const subcategory = course.category_id
      ? categoryById.get(course.category_id)
      : undefined;
    const parent = subcategory?.parent_id
      ? categoryById.get(subcategory.parent_id)
      : subcategory;

    return (
      parent?.slug === "service" ||
      subcategory?.slug === "service" ||
      course.slug.startsWith("service-")
    );
  };

  const serviceCourseIds = new Set(
    courses
      .filter(isStudyAbroadServiceCourse)
      .map((course) => course.id)
  );
  const koreanCourseIds = new Set(koreanScope.courseIds);

  // 学生任务区只接收老师发布的作业和考试。
  // 历史 quiz 数据由课程测试中心承接，不再混入老师任务清单。
  const assignments = allAssignments.filter(
    (assignment) =>
      assignment.assignment_type !== "quiz" &&
      (!assignment.course_id || koreanCourseIds.has(assignment.course_id)) &&
      (!assignment.course_id || !serviceCourseIds.has(assignment.course_id))
  );

  const latestByAssignment = getLatestSubmissions(submissions);
  const progressByAssignment = new Map(
    assignmentProgress.map((progress) => [progress.assignment_id, progress]),
  );
  const boardItems = assignments.map((assignment) => {
    const course = assignment.course_id
      ? courseById.get(assignment.course_id)
      : undefined;
    const subcategory = course?.category_id
      ? categoryById.get(course.category_id)
      : undefined;
    const parent = subcategory?.parent_id
      ? categoryById.get(subcategory.parent_id)
      : subcategory;
    const latest = latestByAssignment.get(assignment.id);
    const progress = progressByAssignment.get(assignment.id);
    const unlockProgress = assignment.unlock_test_slug
      ? ebookProgressBySlug.get(assignment.unlock_test_slug)
      : undefined;
    const chapterUnlockPending =
      !isManager &&
      assignment.unlock_after_chapter_completion &&
      !unlockProgress?.completed_at;
    const effectiveDueAt =
      !isManager &&
      assignment.unlock_after_chapter_completion &&
      unlockProgress?.completed_at &&
      assignment.due_days_after_unlock
        ? new Date(
            new Date(unlockProgress.completed_at).getTime() +
              assignment.due_days_after_unlock * 86_400_000,
          ).toISOString()
        : assignment.due_at;

    return {
      ...assignment,
      due_at: effectiveDueAt,
      chapterUnlockPending,
      courseTitle: course?.title ?? "综合学习任务",
      courseGroup: parent?.title ?? "综合任务",
      courseGroupSlug: parent?.slug ?? "general",
      latestSubmission: latest
        ? {
            score: latest.score,
            feedback: latest.overall_feedback,
            attemptNumber: latest.attempt_number,
          }
        : null,
      progressState: progress?.progress_state ?? latest?.submission_state ?? null,
    };
  });

  const hasReadError =
    Boolean(assignmentsResult.error) ||
    Boolean(submissionsResult.error) ||
    Boolean(coursesResult.error) ||
    Boolean(categoriesResult.error) ||
    Boolean(chapterTestsResult.error) ||
    Boolean(chapterQuestionsResult.error) ||
    Boolean(ebookProgressResult.error) ||
    Boolean(assignmentProgressResult.error) ||
    Boolean(chapterAttemptError);

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1280px] space-y-4 px-4 sm:px-6 lg:px-8">
        {isManager && (
          <div className="flex justify-end">
            <Link
              href="/dashboard/admin/assignments"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white"
              style={{ backgroundColor: "var(--support)" }}
            >
              进入作业管理
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        )}

        {hasReadError && (
          <section
            role="alert"
            className="rounded-2xl border p-4 text-sm font-bold"
            style={{
              color: "var(--status-warning)",
              backgroundColor: "var(--status-warning-surface)",
              borderColor: "var(--status-warning)",
            }}
          >
            学习任务暂时无法完整读取，请稍后刷新页面。
          </section>
        )}

        <AssignmentBoard
          key={initialTaskTypeFilter}
          items={boardItems}
          chapterTests={chapterTests}
          isManager={isManager}
          currentTime={currentTime}
          preferenceScope={`${tenant?.id ?? "platform"}:${user.id}`}
          initialTaskTypeFilter={initialTaskTypeFilter}
        />
      </div>
    </div>
  );
}
