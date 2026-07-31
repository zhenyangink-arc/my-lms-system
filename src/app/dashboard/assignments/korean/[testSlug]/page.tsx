import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { requireAssignmentViewer } from "@/lib/learning-assignments";
import { isPlatformTenantManagerRole } from "@/lib/admin";
import { getUnlockedKoreanTestSlugs } from "@/lib/korean-learning-unlocks";
import {
  buildPublicKoreanChapterTest,
  type CourseTestQuestionRow,
  type CourseTestRow,
} from "@/lib/korean-chapter-tests";
import { createAdminClient } from "@/lib/supabase/admin";
import { KoreanChapterTestRunner } from "./KoreanChapterTestRunner";

export default async function KoreanChapterTestPage({
  params,
}: {
  params: Promise<{ testSlug: string }>;
}) {
  const { testSlug } = await params;
  const { supabase, user, role, isManager } = await requireAssignmentViewer();
  const admin = createAdminClient();
  const { data: testData } = await admin
    .from("course_tests")
    .select(
      "id,lesson_id,slug,course_key,chapter_number,title,korean_title,description,duration_minutes,passing_score,skills,version,status"
    )
    .eq("slug", testSlug)
    .eq("status", "published")
    .maybeSingle();
  if (!testData) notFound();
  const test = testData as CourseTestRow;
  const { data: attemptData } = await supabase
    .from("course_test_attempts")
    .select("test_slug")
    .eq("student_id", user.id);
  const unlockedTestSlugs = getUnlockedKoreanTestSlugs(
    (attemptData ?? []).map((attempt) => String(attempt.test_slug))
  );
  if (
    !isPlatformTenantManagerRole(role) &&
    !unlockedTestSlugs.has(test.slug)
  ) {
    redirect("/dashboard/assignments/korean");
  }
  const { data: questionData } = await admin
    .from("course_test_questions")
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
    .from("course_question_reviews")
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
          href="/dashboard/assignments/korean"
          className="app-muted-text inline-flex items-center gap-2 text-xs font-black"
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
