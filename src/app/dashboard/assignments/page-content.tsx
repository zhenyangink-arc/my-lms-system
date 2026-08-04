import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { requireAssignmentViewer } from "@/lib/learning-assignments";
import { getUnlockedKoreanTestSlugs } from "@/lib/korean-learning-unlocks";
import type { CourseTestRow } from "@/lib/korean-chapter-tests";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  type AssignmentType,
  type SubmissionStatus,
} from "./config";
import { AssignmentBoard } from "./AssignmentBoard";

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
};

type SubmissionRow = {
  id: string;
  assignment_id: string;
  attempt_number: number;
  status: SubmissionStatus;
  score: number | null;
  overall_feedback: string | null;
  submitted_at: string;
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

export default async function AssignmentsPage() {
  const { supabase, user, isManager } = await requireAssignmentViewer();
  const admin = createAdminClient();
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
  ] =
    await Promise.all([
      supabase
        .from("learning_assignments")
        .select(
          "id,title,description,assignment_type,course_id,total_points,starts_at,due_at,duration_minutes,allow_resubmission"
        )
        .eq("status", "published")
        .order("due_at", { ascending: true }),
      isManager
        ? Promise.resolve({ data: [] as SubmissionRow[], error: null })
        : supabase
            .from("learning_submissions")
            .select(
              "id,assignment_id,attempt_number,status,score,overall_feedback,submitted_at"
            )
            .eq("student_id", user.id)
            .order("attempt_number", { ascending: false }),
      supabase.from("courses").select("id,title,slug,category_id"),
      supabase
        .from("course_categories")
        .select("id,parent_id,slug,title"),
      admin
        .from("chapter_tests")
        .select(
          "id,lesson_id,slug,course_key,chapter_number,title,korean_title,description,duration_minutes,passing_score,skills,version,status"
        )
        .in("course_key", ["hangul-introduction", "korean-level-one"])
        .eq("status", "published")
        .order("chapter_number", { ascending: true }),
      admin
        .from("chapter_test_questions")
        .select("test_id")
        .eq("status", "published")
        .eq("question_type", "single_choice")
        .eq("is_chapter_test_item", true),
    ]);

  const allAssignments = (assignmentsResult.data ?? []) as AssignmentRow[];
  const submissions = (submissionsResult.data ?? []) as SubmissionRow[];
  const courses = (coursesResult.data ?? []) as CourseRow[];
  const categories = (categoriesResult.data ?? []) as CategoryRow[];
  const allChapterTests = (chapterTestsResult.data ?? []) as CourseTestRow[];

  const { data: chapterAttemptData } = allChapterTests.length
    ? await supabase
        .from("chapter_test_attempts")
        .select("test_slug,score,passed,attempted_at")
        .eq("student_id", user.id)
        .in(
          "test_slug",
          allChapterTests.map((test) => test.slug)
        )
        .order("attempted_at", { ascending: false })
    : { data: [] as ChapterTestAttemptRow[] };

  const latestAttemptBySlug = new Map<string, ChapterTestAttemptRow>();
  for (const attempt of (chapterAttemptData ?? []) as ChapterTestAttemptRow[]) {
    if (!latestAttemptBySlug.has(attempt.test_slug)) {
      latestAttemptBySlug.set(attempt.test_slug, attempt);
    }
  }
  const unlockedTestSlugs = isManager
    ? new Set(allChapterTests.map((test) => test.slug))
    : getUnlockedKoreanTestSlugs(latestAttemptBySlug.keys());
  const questionCountByTestId = new Map<string, number>();
  for (const question of chapterQuestionsResult.data ?? []) {
    const testId = String(question.test_id);
    questionCountByTestId.set(testId, (questionCountByTestId.get(testId) ?? 0) + 1);
  }

  const chapterTests = allChapterTests
    .filter((test) => unlockedTestSlugs.has(test.slug))
    .map((test) => {
      const attempt = latestAttemptBySlug.get(test.slug);
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
        attempt: attempt
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

  // 学生任务区只接收老师发布的作业和考试。
  // 历史 quiz 数据由课程测试中心承接，不再混入老师任务清单。
  const assignments = allAssignments.filter(
    (assignment) =>
      assignment.assignment_type !== "quiz" &&
      (!assignment.course_id || !serviceCourseIds.has(assignment.course_id))
  );

  const latestByAssignment = getLatestSubmissions(submissions);
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

    return {
      ...assignment,
      courseTitle: course?.title ?? "综合学习任务",
      courseGroup: parent?.title ?? "综合任务",
      courseGroupSlug: parent?.slug ?? "general",
      latestSubmission: latest
        ? {
            status: latest.status,
            score: latest.score,
            feedback: latest.overall_feedback,
            attemptNumber: latest.attempt_number,
          }
        : null,
    };
  });

  const hasReadError =
    Boolean(assignmentsResult.error) ||
    Boolean(submissionsResult.error) ||
    Boolean(coursesResult.error) ||
    Boolean(categoriesResult.error) ||
    Boolean(chapterTestsResult.error) ||
    Boolean(chapterQuestionsResult.error);

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1500px] space-y-5 px-4 sm:px-6 lg:px-8">
        {isManager && (
          <div className="flex justify-end">
            <Link
              href="/dashboard/admin/assignments"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white"
              style={{ backgroundColor: "var(--app-secondary)" }}
            >
              进入作业管理
              <ArrowRight size={15} />
            </Link>
          </div>
        )}

        {hasReadError && (
          <section
            className="rounded-2xl border p-4 text-sm font-bold"
            style={{
              color: "var(--app-warm)",
              backgroundColor: "var(--app-warm-soft)",
              borderColor: "var(--app-warm)",
            }}
          >
            学习任务暂时无法完整读取，请稍后刷新页面。
          </section>
        )}

        <AssignmentBoard
          items={boardItems}
          chapterTests={chapterTests}
          isManager={isManager}
          currentTime={currentTime}
        />
      </div>
    </div>
  );
}
