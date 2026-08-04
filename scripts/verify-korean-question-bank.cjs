const { loadEnvConfig } = require("@next/env");
const { createClient } = require("@supabase/supabase-js");

loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !serviceRole || !publishableKey) {
  throw new Error("Missing Supabase environment variables");
}

const admin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anonymous = createClient(url, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { data: tests, error: testsError } = await admin
    .from("chapter_tests")
    .select("id,slug,chapter_number,title")
    .eq("course_key", "hangul-introduction")
    .order("chapter_number");
  if (testsError) throw testsError;

  const testIds = tests.map((test) => test.id);
  const { data: questions, error: questionError } = await admin
    .from("chapter_test_questions")
    .select(
      "test_id,question_key,prompt,options,correct_option,difficulty,status,question_type,is_chapter_test_item"
    )
    .in("test_id", testIds)
    .eq("status", "published")
    .eq("question_type", "single_choice")
    .order("sort_order");
  if (questionError) throw questionError;

  const difficulties = ["foundation", "medium"];
  const chapters = tests.map((test) => {
    const rows = questions.filter((question) => question.test_id === test.id);
    return {
      chapter: test.chapter_number,
      slug: test.slug,
      total: rows.length,
      chapterTestItems: rows.filter((question) => question.is_chapter_test_item)
        .length,
      difficulty: Object.fromEntries(
        difficulties.map((difficulty) => [
          difficulty,
          rows.filter((question) => question.difficulty === difficulty).length,
        ])
      ),
    };
  });

  const invalidOptions = questions.filter(
    (question) => !Array.isArray(question.options) || question.options.length !== 4
  );
  const invalidAnswers = questions.filter(
    (question) =>
      !Number.isInteger(question.correct_option) ||
      question.correct_option < 0 ||
      question.correct_option >= question.options.length
  );
  const duplicatePrompts = questions.filter((question, index, all) =>
    all.findIndex(
      (candidate) =>
        candidate.test_id === question.test_id &&
        candidate.prompt === question.prompt
    ) !== index
  );
  const { error: anonymousAnswerError } = await anonymous
    .from("chapter_test_questions")
    .select("correct_option")
    .limit(1);

  const valid =
    questions.length === 160 &&
    chapters.every(
      (chapter) =>
        chapter.total === 40 &&
        chapter.chapterTestItems === 10 &&
        difficulties.every(
          (difficulty) => chapter.difficulty[difficulty] === 20
        )
    ) &&
    invalidOptions.length === 0 &&
    invalidAnswers.length === 0 &&
    duplicatePrompts.length === 0 &&
    Boolean(anonymousAnswerError);

  console.log(
    JSON.stringify(
      {
        valid,
        total: questions.length,
        chapters,
        invalidOptions: invalidOptions.length,
        invalidAnswers: invalidAnswers.length,
        duplicatePrompts: duplicatePrompts.length,
        anonymousAnswerAccess: anonymousAnswerError ? "blocked" : "unexpectedly allowed",
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
