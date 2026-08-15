"use server";

import { requireActiveUser } from "@/lib/auth";
import { EBOOK_CHAPTER_TARGET_SECONDS } from "@/lib/korean-ebook-progress";
import { parseQuestionOptions } from "@/lib/korean-chapter-tests";
import { HANGUL_TEST_SEQUENCE } from "@/lib/korean-learning-unlocks";
import {
  canUseStudentFeature,
  normalizeMembershipTier,
} from "@/lib/student-permissions";
import { STUDENT_APP_IDS } from "@/lib/student-apps";
import { createAdminClient } from "@/lib/supabase/admin";

export type KoreanBookReviewAnswerResult = {
  status: "success" | "error";
  correct: boolean;
  message: string;
};

export async function saveKoreanEbookProgressAction(input: {
  testSlug: string;
  currentPage: number | null;
  totalPages: number;
  readPages?: number[];
  readingSeconds?: number;
  eventId?: string;
}) {
  const { supabase, user, profile, tenant } = await requireActiveUser();
  if (profile?.role === "platform_course_inspector") {
    return { status: "success" as const };
  }
  if (!tenant?.id) return { status: "error" as const };
  const testSlug = String(input.testSlug ?? "").trim();
  // currentPage 为 null 表示「本地区没有该章的进度快照」，不覆盖数据库里已存的页码。
  const currentPage =
    input.currentPage == null
      ? null
      : Math.max(0, Math.floor(Number(input.currentPage)));
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

  const readingSeconds = Math.min(
    35,
    Math.max(0, Math.floor(Number(input.readingSeconds) || 0))
  );
  const eventId = String(input.eventId ?? "").trim();
  const hasValidEventId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      eventId
    );

  if (
    !testSlug ||
    testSlug.length > 160 ||
    (currentPage !== null && !Number.isFinite(currentPage)) ||
    !Number.isFinite(totalPages) ||
    totalPages > 500 ||
    (eventId.length > 0 && !hasValidEventId)
  ) {
    return { status: "error" as const };
  }

  const admin = createAdminClient();
  const { data: test } = await admin
    .from("chapter_tests")
    .select("slug")
    .eq("slug", testSlug)
    .eq("student_app_id", STUDENT_APP_IDS.korean)
    .in("course_key", ["hangul-introduction", "korean-level-one"])
    .eq("status", "published")
    .maybeSingle();
  if (!test) return { status: "error" as const };

  const { data: existingProgress } = await supabase
    .from("course_ebook_progress")
    .select("reading_seconds")
    .eq("student_id", user.id)
    .eq("test_slug", testSlug)
    .maybeSingle();
  if (Number(existingProgress?.reading_seconds) > 86_400) {
    const { error: resetError } = await admin
      .from("course_ebook_progress")
      .update({
        reading_seconds: 0,
        progress_percent: 0,
        read_pages: [],
      })
      .eq("tenant_id", tenant.id)
      .eq("student_id", user.id)
      .eq("test_slug", testSlug);
    if (resetError) return { status: "error" as const };
  }

  // 合并交给数据库原子完成（advisory lock 串行化），不再自己查询-合并-覆盖写回：
  // 快速翻页触发的连续保存不会再互相用旧集合覆盖对方刚合并进去的页码。
  const rpcInput = {
    p_test_slug: testSlug,
    p_current_page:
      currentPage === null ? null : Math.min(currentPage, totalPages - 1),
    p_total_pages: totalPages,
    p_new_read_pages: newlyReadPages,
    p_reading_seconds: readingSeconds,
  };
  const useIdempotentSegment = readingSeconds > 0 && hasValidEventId;
  let saveResult = useIdempotentSegment
    ? await supabase.rpc("record_ebook_progress_segment", {
        p_event_id: eventId,
        ...rpcInput,
      })
    : await supabase.rpc("record_ebook_progress", rpcInput);
  if (
    useIdempotentSegment &&
    saveResult.error &&
    (saveResult.error.code === "PGRST202" ||
      saveResult.error.code === "42883" ||
      saveResult.error.message.includes("record_ebook_progress_segment"))
  ) {
    // 允许应用代码先于数据库迁移部署：迁移尚未应用时继续使用旧 RPC 保存，
    // 避免页面看似计时、刷新后却回到旧值。
    saveResult = await supabase.rpc("record_ebook_progress", rpcInput);
  }
  const { data: savedProgress, error } = saveResult;
  const savedRow = Array.isArray(savedProgress)
    ? savedProgress[0]
    : savedProgress;
  const savedTotalSeconds = Math.max(
    0,
    Number(savedRow?.reading_seconds) || 0
  );

  if (!error) {
    // 学习满 2 分钟才算“开始学习”：累计阅读秒数 ≥120 时，同步把该课时的
    // lesson_progress 标为 in_progress，老师端“我的学生”进度无需等学生再次
    // 打开课时页即可看到；未满 2 分钟不产生课时进度记录。
    try {
      const { data: ebookRow } = await supabase
        .from("course_ebook_progress")
        .select("reading_seconds")
        .eq("student_id", user.id)
        .eq("test_slug", testSlug)
        .maybeSingle();
      const totalSeconds =
        savedTotalSeconds || Number(ebookRow?.reading_seconds) || 0;
      if (totalSeconds >= 120) {
        const { data: testInfo } = await admin
          .from("chapter_tests")
          .select("lesson_id")
          .eq("slug", testSlug)
          .eq("student_app_id", STUDENT_APP_IDS.korean)
          .eq("status", "published")
          .maybeSingle();
        const lessonId = testInfo?.lesson_id ? String(testInfo.lesson_id) : null;
        if (lessonId) {
          const { data: lessonInfo } = await admin
            .from("lessons")
            .select("course_id")
            .eq("id", lessonId)
            .maybeSingle();
          const { data: existing } = await supabase
            .from("lesson_progress")
            .select("status, started_at")
            .eq("user_id", user.id)
            .eq("lesson_id", lessonId)
            .maybeSingle();
          if (existing?.status !== "completed") {
            const now = new Date().toISOString();
            await supabase.from("lesson_progress").upsert(
              {
                user_id: user.id,
                course_id: lessonInfo?.course_id ?? null,
                lesson_id: lessonId,
                status: "in_progress",
                progress_percent: Math.min(
                  100,
                  Math.round(
                    (totalSeconds / EBOOK_CHAPTER_TARGET_SECONDS) * 100
                  )
                ),
                started_at: existing?.started_at ?? now,
                last_viewed_at: now,
                updated_at: now,
              },
              { onConflict: "user_id,lesson_id" }
            );
          }
        }
      }
    } catch {
      // 课时进度联动失败不影响电子书进度保存本身。
    }
  }

  return {
    status: error ? ("error" as const) : ("success" as const),
    totalReadingSeconds: error ? undefined : savedTotalSeconds,
  };
}

export async function checkKoreanBookReviewAnswer(
  testSlug: string,
  questionKey: string,
  selectedOption: number
): Promise<KoreanBookReviewAnswerResult> {
  const auth = await requireActiveUser();

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
    .eq("student_app_id", STUDENT_APP_IDS.korean)
    .eq("status", "published")
    .maybeSingle();
  if (!test) {
    return { status: "error", correct: false, message: "没有找到本章题目。" };
  }
  const { data: lesson } = await admin
    .from("lessons")
    .select("id,course_id,is_free_preview")
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

  // 这是未鉴权就能反复试答案的探测面：光靠"已登录"挡不住任何登录用户
  // 枚举出正确选项，必须同时校验会员档位权限和课时解锁顺序。
  const role = auth.profile?.role ?? "student";
  const membershipTier = normalizeMembershipTier(auth.profile?.membership_tier);
  const hasFullKoreanCourseAccess = canUseStudentFeature(role, membershipTier, "korean_course");
  const hasPreviewAccess =
    Boolean(lesson.is_free_preview) && canUseStudentFeature(role, membershipTier, "course_preview");
  const hasLessonAccess = role !== "student" || hasFullKoreanCourseAccess || hasPreviewAccess;
  if (!hasLessonAccess) {
    return { status: "error", correct: false, message: "当前账号没有这门课程的学习权限。" };
  }

  if (role === "student") {
    const chapterIndex = HANGUL_TEST_SEQUENCE.indexOf(
      testSlug as (typeof HANGUL_TEST_SEQUENCE)[number]
    );
    if (chapterIndex > 0) {
      const previousSlug = HANGUL_TEST_SEQUENCE[chapterIndex - 1];
      const { data: previousPass } = await admin
        .from("chapter_test_attempts")
        .select("id")
        .eq("student_id", auth.user.id)
        .eq("test_slug", previousSlug)
        .eq("passed", true)
        .maybeSingle();
      if (!previousPass) {
        return { status: "error", correct: false, message: "请先完成前面章节的测试，再作答这一章。" };
      }
    }
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
