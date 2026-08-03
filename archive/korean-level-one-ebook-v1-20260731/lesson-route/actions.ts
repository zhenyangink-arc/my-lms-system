"use server";

import { requireActiveUser } from "@/lib/auth";
import { parseQuestionOptions } from "@/lib/korean-chapter-tests";
import { createAdminClient } from "@/lib/supabase/admin";

export type KoreanBookReviewAnswerResult = {
  status: "success" | "error";
  correct: boolean;
  message: string;
};

export async function saveKoreanEbookProgressAction(input: {
  testSlug: string;
  currentPage: number;
  totalPages: number;
  readPages?: number[];
}) {
  const { supabase, user } = await requireActiveUser();
  const testSlug = String(input.testSlug ?? "").trim();
  const currentPage = Math.max(0, Math.floor(Number(input.currentPage)));
  const totalPages = Math.max(1, Math.floor(Number(input.totalPages)));
  const newlyReadPages = Array.from(
    new Set(
      (Array.isArray(input.readPages) ? input.readPages : [])
        .map((page) => Math.floor(Number(page)))
        .filter(
          (page) =>
            Number.isFinite(page) && page >= 0 && page < totalPages
        )
    )
  ).slice(0, 500);

  if (
    !testSlug ||
    testSlug.length > 160 ||
    !Number.isFinite(currentPage) ||
    !Number.isFinite(totalPages) ||
    totalPages > 500
  ) {
    return { status: "error" as const };
  }

  const admin = createAdminClient();
  const { data: test } = await admin
    .from("chapter_tests")
    .select("slug")
    .eq("slug", testSlug)
    .in("course_key", ["hangul-introduction", "korean-level-one"])
    .eq("status", "published")
    .maybeSingle();
  if (!test) return { status: "error" as const };

  const now = new Date().toISOString();
  const { data: existing } = await supabase
    .from("course_ebook_progress")
    .select("read_pages")
    .eq("student_id", user.id)
    .eq("test_slug", testSlug)
    .maybeSingle();
  const readPages = Array.from(
    new Set([
      ...((existing?.read_pages as number[] | null) ?? []),
      ...newlyReadPages,
    ])
  )
    .filter((page) => page >= 0 && page < totalPages)
    .sort((a, b) => a - b);
  const progressPercent = Math.min(
    100,
    Math.round((readPages.length / totalPages) * 100)
  );
  const { error } = await supabase.from("course_ebook_progress").upsert(
    {
      student_id: user.id,
      test_slug: testSlug,
      current_page: Math.min(currentPage, totalPages - 1),
      total_pages: totalPages,
      progress_percent: progressPercent,
      read_pages: readPages,
      last_read_at: now,
      updated_at: now,
    },
    { onConflict: "student_id,test_slug" }
  );

  return { status: error ? ("error" as const) : ("success" as const) };
}

export async function checkKoreanBookReviewAnswer(
  testSlug: string,
  questionKey: string,
  selectedOption: number
): Promise<KoreanBookReviewAnswerResult> {
  await requireActiveUser();

  if (
    !testSlug ||
    !questionKey ||
    !Number.isInteger(selectedOption) ||
    selectedOption < 0
  ) {
    return { status: "error", correct: false, message: "答案格式不正确。" };
  }

  const admin = createAdminClient();
  const { data: test } = await admin
    .from("chapter_tests")
    .select("id,lesson_id")
    .eq("slug", testSlug)
    .eq("status", "published")
    .maybeSingle();
  if (!test) {
    return { status: "error", correct: false, message: "没有找到本章题目。" };
  }
  const { data: lesson } = await admin
    .from("lessons")
    .select("id,course_id")
    .eq("id", test.lesson_id)
    .eq("slug", "hangul-introduction")
    .maybeSingle();
  if (!lesson) {
    return { status: "error", correct: false, message: "本章不属于韩文字母入门。" };
  }
  const { data: course } = await admin
    .from("courses")
    .select("id")
    .eq("id", lesson.course_id)
    .eq("slug", "korean-beginner")
    .maybeSingle();
  if (!course) {
    return { status: "error", correct: false, message: "本章课程归属不正确。" };
  }

  const { data: question } = await admin
    .from("chapter_test_questions")
    .select("options,correct_option")
    .eq("test_id", test.id)
    .eq("question_key", questionKey)
    .eq("status", "published")
    .eq("question_type", "single_choice")
    .eq("is_chapter_test_item", true)
    .maybeSingle();
  const options = parseQuestionOptions(question?.options);
  if (
    !question ||
    selectedOption >= options.length ||
    !Number.isInteger(question.correct_option)
  ) {
    return { status: "error", correct: false, message: "这道题暂时不可作答。" };
  }

  const correct = selectedOption === question.correct_option;
  return {
    status: "success",
    correct,
    message: correct ? "回答正确" : "再想一想",
  };
}
