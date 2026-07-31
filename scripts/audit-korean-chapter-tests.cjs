/* eslint-disable @typescript-eslint/no-require-imports */
const { loadEnvConfig } = require("@next/env");
const { createClient } = require("@supabase/supabase-js");

loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) throw new Error("Missing Supabase environment variables");

const db = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchAll(queryFactory) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await queryFactory().range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

function hasHan(value) {
  return /[\u3400-\u4dbf\u4e00-\u9fff]/u.test(value);
}

function hasHangul(value) {
  return /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u.test(value);
}

async function main() {
  const tests = await fetchAll(() =>
    db
      .from("course_tests")
      .select(
        "id,lesson_id,slug,course_key,chapter_number,title,korean_title,duration_minutes,passing_score,status"
      )
      .in("course_key", ["hangul-introduction", "korean-level-one"])
      .order("course_key")
      .order("chapter_number")
  );
  const testIds = tests.map((test) => test.id);
  const questions = await fetchAll(() =>
    db
      .from("course_test_questions")
      .select(
        "id,test_id,question_key,prompt,options,correct_option,difficulty,status,question_type,is_chapter_test_item"
      )
      .in("test_id", testIds)
      .order("test_id")
      .order("sort_order")
  );
  const attempts = await fetchAll(() =>
    db
      .from("course_test_attempts")
      .select(
        "id,tenant_id,student_id,test_id,test_slug,score,correct_count,total_questions,passed"
      )
      .order("attempted_at")
  );
  const reviews = await fetchAll(() =>
    db
      .from("course_question_reviews")
      .select("id,student_id,test_id,question_id")
      .order("created_at")
  );
  const lessonIds = [...new Set(tests.map((test) => test.lesson_id))];
  const { data: lessonData, error: lessonError } = await db
    .from("lessons")
    .select("id,slug,title")
    .in("id", lessonIds);
  if (lessonError) throw lessonError;

  const testsById = new Map(tests.map((test) => [test.id, test]));
  const questionsById = new Map(
    questions.map((question) => [question.id, question])
  );
  const lessonsById = new Map(
    (lessonData ?? []).map((lesson) => [lesson.id, lesson])
  );
  const difficulties = ["foundation", "medium", "hard", "expert"];
  const expected = {
    "hangul-introduction": {
      count: 4,
      slugs: [
        "meet-hangul",
        "vowels-and-consonants",
        "batchim-and-reading",
        "pronunciation-rules-and-reading",
      ],
      passingScore: 80,
    },
    "korean-level-one": {
      count: 16,
      slugs: Array.from(
        { length: 16 },
        (_, index) =>
          `korean-level-one-${String(index + 1).padStart(2, "0")}`
      ),
      passingScore: 60,
    },
  };

  const courseReports = Object.fromEntries(
    Object.entries(expected).map(([courseKey, rule]) => {
      const courseTests = tests.filter((test) => test.course_key === courseKey);
      const chapterReports = courseTests.map((test) => {
        const rows = questions.filter(
          (question) => question.test_id === test.id
        );
        return {
          chapter: test.chapter_number,
          slug: test.slug,
          lesson: lessonsById.get(test.lesson_id)?.slug ?? null,
          total: rows.length,
          active: rows.filter((question) => question.is_chapter_test_item)
            .length,
          difficulty: Object.fromEntries(
            difficulties.map((difficulty) => [
              difficulty,
              rows.filter((question) => question.difficulty === difficulty)
                .length,
            ])
          ),
        };
      });
      const actualChapters = courseTests.map((test) => test.chapter_number);
      const expectedChapters = Array.from(
        { length: rule.count },
        (_, index) => index + 1
      );
      return [
        courseKey,
        {
          tests: courseTests.length,
          published: courseTests.filter((test) => test.status === "published")
            .length,
          chapterSequenceCorrect:
            JSON.stringify(actualChapters) === JSON.stringify(expectedChapters),
          slugsCorrect:
            JSON.stringify(courseTests.map((test) => test.slug)) ===
            JSON.stringify(rule.slugs),
          passingScoresCorrect: courseTests.every(
            (test) => test.passing_score === rule.passingScore
          ),
          chapters: chapterReports,
        },
      ];
    })
  );

  const invalidOptions = questions.filter(
    (question) =>
      !Array.isArray(question.options) || question.options.length !== 4
  );
  const invalidAnswers = questions.filter(
    (question) =>
      !Array.isArray(question.options) ||
      !Number.isInteger(question.correct_option) ||
      question.correct_option < 0 ||
      question.correct_option >= question.options.length
  );
  const duplicateQuestionKeys = questions.filter(
    (question, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.test_id === question.test_id &&
          candidate.question_key === question.question_key
      ) !== index
  );
  const duplicatePrompts = questions.filter(
    (question, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.test_id === question.test_id &&
          candidate.prompt === question.prompt
      ) !== index
  );
  const levelOneQuestions = questions.filter(
    (question) =>
      testsById.get(question.test_id)?.course_key === "korean-level-one"
  );
  const levelOneFoundationWithoutChinese = levelOneQuestions.filter(
    (question) =>
      question.difficulty === "foundation" && !hasHan(question.prompt)
  );
  const levelOneAdvancedWithChinese = levelOneQuestions.filter(
    (question) =>
      question.difficulty !== "foundation" &&
      (hasHan(question.prompt) ||
        question.options.some((option) => hasHan(String(option))))
  );
  const levelOneAdvancedWithoutHangul = levelOneQuestions.filter(
    (question) =>
      question.difficulty !== "foundation" &&
      (!hasHangul(question.prompt) ||
        question.options.some((option) => !hasHangul(String(option))))
  );

  const invalidAttempts = attempts.filter((attempt) => {
    const test = testsById.get(attempt.test_id);
    return (
      !test ||
      attempt.test_slug !== test.slug ||
      attempt.correct_count < 0 ||
      attempt.correct_count > attempt.total_questions ||
      attempt.score < 0 ||
      attempt.score > 100 ||
      attempt.passed !== (attempt.score >= test.passing_score)
    );
  });
  const duplicateAttempts = attempts.filter(
    (attempt, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.tenant_id === attempt.tenant_id &&
          candidate.student_id === attempt.student_id &&
          candidate.test_slug === attempt.test_slug
      ) !== index
  );
  const invalidReviews = reviews.filter((review) => {
    const question = questionsById.get(review.question_id);
    return !question || question.test_id !== review.test_id;
  });
  const duplicateReviews = reviews.filter(
    (review, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.student_id === review.student_id &&
          candidate.question_id === review.question_id
      ) !== index
  );

  const courseShapeValid = Object.entries(courseReports).every(
    ([courseKey, report]) => {
      const rule = expected[courseKey];
      return (
        report.tests === rule.count &&
        report.published === rule.count &&
        report.chapterSequenceCorrect &&
        report.slugsCorrect &&
        report.passingScoresCorrect &&
        report.chapters.every(
          (chapter) =>
            chapter.total === 80 &&
            chapter.active === 10 &&
            difficulties.every(
              (difficulty) => chapter.difficulty[difficulty] === 20
            )
        )
      );
    }
  );
  const valid =
    tests.length === 20 &&
    questions.length === 1600 &&
    courseShapeValid &&
    invalidOptions.length === 0 &&
    invalidAnswers.length === 0 &&
    duplicateQuestionKeys.length === 0 &&
    duplicatePrompts.length === 0 &&
    levelOneFoundationWithoutChinese.length === 0 &&
    levelOneAdvancedWithChinese.length === 0 &&
    levelOneAdvancedWithoutHangul.length === 0 &&
    invalidAttempts.length === 0 &&
    duplicateAttempts.length === 0 &&
    invalidReviews.length === 0 &&
    duplicateReviews.length === 0;

  console.log(
    JSON.stringify(
      {
        valid,
        totals: {
          tests: tests.length,
          questions: questions.length,
          attempts: attempts.length,
          reviews: reviews.length,
        },
        courseReports,
        integrity: {
          invalidOptions: invalidOptions.length,
          invalidAnswers: invalidAnswers.length,
          duplicateQuestionKeys: duplicateQuestionKeys.length,
          duplicatePrompts: duplicatePrompts.length,
          levelOneFoundationWithoutChinese:
            levelOneFoundationWithoutChinese.length,
          levelOneAdvancedWithChinese: levelOneAdvancedWithChinese.length,
          levelOneAdvancedWithoutHangul: levelOneAdvancedWithoutHangul.length,
          invalidAttempts: invalidAttempts.length,
          duplicateAttempts: duplicateAttempts.length,
          invalidReviews: invalidReviews.length,
          duplicateReviews: duplicateReviews.length,
        },
      },
      null,
      2
    )
  );
  if (!valid) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
