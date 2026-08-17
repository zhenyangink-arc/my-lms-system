import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { requireAssignmentViewer } from "@/lib/learning-assignments";
import {
  getUnlockedKoreanTestSlugs,
  isKoreanEbookCompleted,
} from "@/lib/korean-learning-unlocks";
import {
  buildPublicKoreanChapterTest,
  type CourseTestQuestionRow,
  type CourseTestRow,
} from "@/lib/korean-chapter-tests";
import { withStudentAppSchemaFallback } from "@/lib/student-app-data";
import { STUDENT_APP_IDS } from "@/lib/student-apps";
import { createAdminClient } from "@/lib/supabase/admin";
import { KoreanChapterTestRunner } from "./KoreanChapterTestRunner";

export default async function KoreanChapterTestPage({
  params,
}: {
  params: Promise<{ testSlug: string }>;
}) {
  const { testSlug } = await params;
  const { supabase, user, tenant, isManager } = await requireAssignmentViewer();
  const admin = createAdminClient();
  const { data: testData } = await withStudentAppSchemaFallback(
    admin
      .from("chapter_tests")
      .select(
        "id,lesson_id,slug,course_key,chapter_number,title,korean_title,description,duration_minutes,passing_score,skills,version,status"
      )
      .eq("slug", testSlug)
      .eq("student_app_id", STUDENT_APP_IDS.korean)
      .eq("status", "published")
      .maybeSingle(),
    () =>
      admin
        .from("chapter_tests")
        .select(
          "id,lesson_id,slug,course_key,chapter_number,title,korean_title,description,duration_minutes,passing_score,skills,version,status"
        )
        .eq("slug", testSlug)
        .eq("status", "published")
        .maybeSingle(),
  );
  if (!testData) notFound();
  const test = testData as CourseTestRow;
  const [{ data: attemptData }, { data: ebookProgressData }] = await Promise.all([
    admin
      .from("chapter_test_attempts")
      .select("test_slug,passed")
      .eq("student_id", user.id)
      .eq("tenant_id", tenant?.id ?? ""),
    withStudentAppSchemaFallback(
      admin
        .from("course_ebook_progress")
        .select("test_slug,progress_percent,reading_seconds,read_pages,total_pages")
        .eq("student_id", user.id)
        .eq("tenant_id", tenant?.id ?? "")
        .eq("student_app_id", STUDENT_APP_IDS.korean),
      () =>
        admin
          .from("course_ebook_progress")
          .select("test_slug,progress_percent,reading_seconds,read_pages,total_pages")
          .eq("student_id", user.id)
          .eq("tenant_id", tenant?.id ?? ""),
    ),
  ]);
  const unlockedTestSlugs = getUnlockedKoreanTestSlugs(
    (attemptData ?? [])
      .filter((attempt) => attempt.passed)
      .map((attempt) => String(attempt.test_slug)),
    (ebookProgressData ?? [])
      .filter((progress) =>
        isKoreanEbookCompleted({
          progressPercent: Number(progress.progress_percent),
          readingSeconds: Number(progress.reading_seconds),
          readPages: Array.isArray(progress.read_pages)
            ? progress.read_pages.map(Number)
            : [],
          totalPages: Number(progress.total_pages),
        })
      )
      .map((progress) => String(progress.test_slug)),
  );
  if (!isManager && !unlockedTestSlugs.has(test.slug)) {
    redirect("/dashboard/assignments");
  }
  const { data: questionData } = await admin
    .from("chapter_test_questions")
    .select("id,test_id,question_key,prompt,options,skill,sort_order")
    .eq("test_id", test.id)
    .eq("status", "published")
    .eq("question_type", "single_choice")
    .eq("is_chapter_test_item", true)
    .order("sort_order", { ascending: true });
  const questionRows = (questionData ?? []) as CourseTestQuestionRow[];
  const publicTest = buildPublicKoreanChapterTest(test, questionRows);
  if (publicTest.questions.length === 0) notFound();
  const { data: reviewData } = await supabase
    .from("chapter_test_question_reviews")
    .select("question_id")
    .eq("student_id", user.id)
    .eq("test_id", test.id)
    .in(
      "question_id",
      questionRows.map((question) => question.id)
    );
  const reviewedQuestionIds = new Set(
    (reviewData ?? []).map((review) => String(review.question_id))
  );
  const initialReviewedQuestionKeys = questionRows
    .filter((question) => reviewedQuestionIds.has(question.id))
    .map((question) => question.question_key);
  const ebookLessonSlug =
    test.course_key === "hangul-introduction"
      ? "hangul-introduction"
      : "basic-pronunciation";
  const ebookHref =
    `/dashboard/courses/korean/korean-basic/korean-beginner/${ebookLessonSlug}` +
    `?chapter=${encodeURIComponent(test.slug)}`;

  return (
    <div className="pb-12">
      <div className="mx-auto mt-5 w-full max-w-[1500px] space-y-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/assignments?type=chapter_test"
          className="app-muted-text inline-flex items-center gap-2 text-xs font-bold"
        >
          <ArrowLeft size={14} />
          返回章节测试中心
        </Link>

        <KoreanChapterTestRunner
          test={publicTest}
          previewMode={isManager}
          initialShuffleSeed={crypto.randomUUID()}
          initialReviewedQuestionKeys={initialReviewedQuestionKeys}
          ebookHref={ebookHref}
        />
      </div>
    </div>
  );
}
