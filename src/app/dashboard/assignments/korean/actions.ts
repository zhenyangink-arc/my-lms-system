"use server";

import { revalidateDashboard } from "@/lib/revalidate-dashboard";

import { requireAssignmentViewer } from "@/lib/learning-assignments";
import {
  parseQuestionOptions,
  type CourseTestAnswerRow,
  type CourseTestRow,
  type KoreanTestSkill,
} from "@/lib/korean-chapter-tests";
import {
  getUnlockedKoreanTestSlugs,
  isKoreanChapterLearningCompleted,
} from "@/lib/korean-learning-unlocks";
import { STUDENT_APP_IDS } from "@/lib/student-apps";
import { createAdminClient } from "@/lib/supabase/admin";

type QuestionResult = {
  id: string;
  selectedOption: number;
  correctOption: number;
  correct: boolean;
  explanation: string;
};

type DimensionScore = {
  label: string;
  correct: number;
  total: number;
  percent: number;
};

type DatabaseSubmitPayload = {
  score: number;
  correctCount: number;
  totalQuestions: number;
  passed: boolean;
  dimensionScores: Record<string, DimensionScore>;
  questions: QuestionResult[];
};

export type KoreanChapterTestResult = {
  status: "success" | "error";
  message: string;
  score?: number;
  correctCount?: number;
  totalQuestions?: number;
  passed?: boolean;
  saved?: boolean;
  dimensionScores?: Record<string, DimensionScore>;
  questions?: QuestionResult[];
};

export type KoreanQuestionReviewResult = {
  status: "success" | "error";
  message: string;
};

export async function addKoreanQuestionToReviewAction(input: {
  testSlug: string;
  questionKey: string;
}): Promise<KoreanQuestionReviewResult> {
  const { supabase, user } = await requireAssignmentViewer();
  const testSlug = String(input.testSlug ?? "").trim();
  const questionKey = String(input.questionKey ?? "").trim();

  if (
    !testSlug ||
    !questionKey ||
    testSlug.length > 160 ||
    questionKey.length > 160
  ) {
    return {
      status: "error",
      message: "题目信息不完整，请刷新页面后重试。",
    };
  }

  const admin = createAdminClient();
  const { data: testData } = await admin
    .from("chapter_tests")
    .select("id")
    .eq("slug", testSlug)
    .eq("student_app_id", STUDENT_APP_IDS.korean)
    .eq("status", "published")
    .maybeSingle();

  if (!testData) {
    return { status: "error", message: "没有找到对应的章节测试。" };
  }

  const { data: questionData } = await admin
    .from("chapter_test_questions")
    .select("id")
    .eq("test_id", testData.id)
    .eq("question_key", questionKey)
    .eq("status", "published")
    .eq("question_type", "single_choice")
    .maybeSingle();

  if (!questionData) {
    return { status: "error", message: "没有找到这道题，请刷新后重试。" };
  }

  const { error } = await supabase.from("chapter_test_question_reviews").upsert(
    {
      student_id: user.id,
      test_id: testData.id,
      question_id: questionData.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,question_id" }
  );

  if (error) {
    return {
      status: "error",
      message: error.message || "加入复习失败，请稍后重试。",
    };
  }

  revalidateDashboard("/dashboard/progress");
  revalidateDashboard("/[space]/apps/korean/practice/review", "page");
  return {
    status: "success",
    message: "已加入错题复习，可在巩固中心查看。",
  };
}

export async function removeKoreanQuestionFromReviewAction(input: {
  testSlug: string;
  questionKey: string;
}): Promise<KoreanQuestionReviewResult> {
  const { supabase, user } = await requireAssignmentViewer();
  const testSlug = String(input.testSlug ?? "").trim();
  const questionKey = String(input.questionKey ?? "").trim();

  if (
    !testSlug ||
    !questionKey ||
    testSlug.length > 160 ||
    questionKey.length > 160
  ) {
    return {
      status: "error",
      message: "题目信息不完整，请刷新页面后重试。",
    };
  }

  const admin = createAdminClient();
  const { data: testData } = await admin
    .from("chapter_tests")
    .select("id")
    .eq("slug", testSlug)
    .eq("student_app_id", STUDENT_APP_IDS.korean)
    .eq("status", "published")
    .maybeSingle();

  if (!testData) {
    return { status: "error", message: "没有找到对应的章节测试。" };
  }

  const { data: questionData } = await admin
    .from("chapter_test_questions")
    .select("id")
    .eq("test_id", testData.id)
    .eq("question_key", questionKey)
    .eq("status", "published")
    .eq("question_type", "single_choice")
    .maybeSingle();

  if (!questionData) {
    return { status: "error", message: "没有找到这道题，请刷新后重试。" };
  }

  const { error } = await supabase
    .from("chapter_test_question_reviews")
    .delete()
    .eq("student_id", user.id)
    .eq("question_id", questionData.id);

  if (error) {
    return {
      status: "error",
      message: error.message || "取消加入复习失败，请稍后重试。",
    };
  }

  revalidateDashboard("/dashboard/progress");
  revalidateDashboard("/[space]/apps/korean/practice/review", "page");
  return {
    status: "success",
    message: "已取消加入复习。",
  };
}

function successResult(
  payload: DatabaseSubmitPayload,
  saved: boolean
): KoreanChapterTestResult {
  return {
    status: "success",
    message: payload.passed
      ? "已达到本章掌握线，可以继续学习。"
      : "还没有达到掌握线，建议先复习薄弱知识点再试一次。",
    ...payload,
    saved,
  };
}

function parseDatabasePayload(value: unknown): DatabaseSubmitPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const payload = value as Partial<DatabaseSubmitPayload>;
  if (
    typeof payload.score !== "number" ||
    typeof payload.correctCount !== "number" ||
    typeof payload.totalQuestions !== "number" ||
    typeof payload.passed !== "boolean" ||
    !payload.dimensionScores ||
    typeof payload.dimensionScores !== "object" ||
    !Array.isArray(payload.questions)
  ) {
    return null;
  }

  return payload as DatabaseSubmitPayload;
}

async function scoreManagerPreview(
  testSlug: string,
  answers: Record<string, number>
): Promise<KoreanChapterTestResult> {
  const admin = createAdminClient();
  const { data: testData } = await admin
    .from("chapter_tests")
    .select(
      "id,lesson_id,slug,course_key,chapter_number,title,korean_title,description,duration_minutes,passing_score,skills,version,status"
    )
    .eq("slug", testSlug)
    .eq("student_app_id", STUDENT_APP_IDS.korean)
    .eq("status", "published")
    .maybeSingle();

  if (!testData) {
    return { status: "error", message: "没有找到这份章节测试。" };
  }

  const test = testData as CourseTestRow;
  const { data: questionData } = await admin
    .from("chapter_test_questions")
    .select(
      "id,test_id,question_key,prompt,options,correct_option,explanation,skill,sort_order"
    )
    .eq("test_id", test.id)
    .eq("status", "published")
    .eq("question_type", "single_choice")
    .eq("is_chapter_test_item", true)
    .order("sort_order", { ascending: true });
  const questions = (questionData ?? []) as CourseTestAnswerRow[];

  if (questions.length === 0) {
    return { status: "error", message: "这份测试暂时没有题目。" };
  }

  if (Object.keys(answers).length !== questions.length) {
    return { status: "error", message: "请完成全部题目后再交卷。" };
  }

  const questionResults: QuestionResult[] = [];
  const dimensionCounters = new Map<
    KoreanTestSkill,
    { correct: number; total: number }
  >();

  for (const question of questions) {
    const options = parseQuestionOptions(question.options);
    const selectedOption = Number(answers[question.question_key]);

    if (
      !Number.isInteger(selectedOption) ||
      selectedOption < 0 ||
      selectedOption >= options.length
    ) {
      return {
        status: "error",
        message: "有一道题的答案不正确，请重新选择。",
      };
    }

    const skill = question.skill as KoreanTestSkill;
    const correct = selectedOption === question.correct_option;
    const counter = dimensionCounters.get(skill) ?? { correct: 0, total: 0 };
    counter.total += 1;
    if (correct) counter.correct += 1;
    dimensionCounters.set(skill, counter);

    questionResults.push({
      id: question.question_key,
      selectedOption,
      correctOption: question.correct_option,
      correct,
      explanation: question.explanation,
    });
  }

  const correctCount = questionResults.filter((result) => result.correct).length;
  const totalQuestions = questions.length;
  const score = Math.round((correctCount / totalQuestions) * 100);
  const passed = score >= test.passing_score;
  const skills = (test.skills ?? {}) as Partial<
    Record<KoreanTestSkill, string>
  >;
  const dimensionScores = Object.fromEntries(
    [...dimensionCounters.entries()].map(([skill, counter]) => [
      skill,
      {
        label: skills[skill] ?? skill,
        ...counter,
        percent: Math.round((counter.correct / counter.total) * 100),
      },
    ])
  );

  return successResult(
    {
      score,
      correctCount,
      totalQuestions,
      passed,
      dimensionScores,
      questions: questionResults,
    },
    false
  );
}

export async function submitKoreanChapterTestAction(input: {
  testSlug: string;
  answers: Record<string, number>;
}): Promise<KoreanChapterTestResult> {
  const { supabase, user, tenant, isManager } = await requireAssignmentViewer();
  const testSlug = String(input.testSlug ?? "").trim();
  const answers = input.answers ?? {};

  if (!testSlug) {
    return { status: "error", message: "缺少测试信息，请返回后重试。" };
  }

  // manager 巡查/预览章节测试时只能本地判分，绝不能写进学生成绩表。
  if (isManager) {
    return scoreManagerPreview(testSlug, answers);
  }
  if (!tenant?.id) {
    return { status: "error", message: "当前机构信息不可用，请重新登录后再试。" };
  }

  const admin = createAdminClient();
  const [{ data: attemptData }, { data: ebookProgressData }] =
    await Promise.all([
      admin
        .from("chapter_test_attempts")
        .select("test_slug,passed")
        .eq("student_id", user.id)
        .eq("tenant_id", tenant.id),
      admin
        .from("course_ebook_progress")
        .select("test_slug,progress_percent,reading_seconds,read_pages,total_pages,completion_source")
        .eq("student_id", user.id)
        .eq("tenant_id", tenant.id)
        .eq("student_app_id", STUDENT_APP_IDS.korean),
    ]);
  const passedSlugs = (attemptData ?? [])
    .filter((attempt) => attempt.passed)
    .map((attempt) => String(attempt.test_slug));
  const completedLearningSlugs = (ebookProgressData ?? [])
    .filter((progress) =>
      isKoreanChapterLearningCompleted({
        progressPercent: Number(progress.progress_percent),
        readingSeconds: Number(progress.reading_seconds),
        readPages: Array.isArray(progress.read_pages)
          ? progress.read_pages.map(Number)
          : [],
        totalPages: Number(progress.total_pages),
        completionSource: progress.completion_source
          ? String(progress.completion_source)
          : null,
      })
    )
    .map((progress) => String(progress.test_slug));
  const unlockedTestSlugs = getUnlockedKoreanTestSlugs(
    passedSlugs,
    completedLearningSlugs,
  );

  if (!unlockedTestSlugs.has(testSlug)) {
    const currentChapterIsComplete = completedLearningSlugs.includes(testSlug);
    return {
      status: "error",
      message:
        !currentChapterIsComplete
          ? "请先完成本章电子书或智能教材，再开始章节测试。"
          : "请先通过前面章节的测试，再开始本章测试。",
    };
  }

  const { data, error } = await supabase.rpc("submit_course_test", {
    p_test_slug: testSlug,
    p_answers: answers,
  });

  if (error) {
    return {
      status: "error",
      message: error.message || "交卷失败，请稍后重试。",
    };
  }

  const payload = parseDatabasePayload(data);
  if (!payload) {
    return {
      status: "error",
      message: "数据库返回的成绩格式不正确，请联系管理员。",
    };
  }

  revalidateDashboard("/dashboard/assignments");
  revalidateDashboard("/dashboard/assignments/korean");
  revalidateDashboard("/dashboard/grades");
  revalidateDashboard("/dashboard/progress");
  revalidateDashboard("/[space]/apps/korean/practice", "layout");

  return successResult(payload, true);
}
