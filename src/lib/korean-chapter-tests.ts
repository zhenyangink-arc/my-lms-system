export type KoreanTestSkill =
  | "concept"
  | "structure"
  | "recognition"
  | "assembly"
  | "batchim"
  | "reading"
  | "rules"
  | "strategy";

export type CourseTestRow = {
  id: string;
  lesson_id: string;
  slug: string;
  course_key: string;
  chapter_number: number;
  title: string;
  korean_title: string;
  description: string;
  duration_minutes: number;
  passing_score: number;
  skills: Record<string, string> | null;
  version: number;
  status: string;
};

export type CourseTestQuestionRow = {
  id: string;
  test_id: string;
  question_key: string;
  prompt: string;
  options: unknown;
  skill: string;
  sort_order: number;
};

export type CourseTestAnswerRow = CourseTestQuestionRow & {
  correct_option: number;
  explanation: string;
};

export type PublicKoreanChapterTest = {
  slug: string;
  chapterNumber: number;
  title: string;
  koreanTitle: string;
  description: string;
  durationMinutes: number;
  passingScore: number;
  skills: Partial<Record<KoreanTestSkill, string>>;
  questions: Array<{
    id: string;
    prompt: string;
    options: string[];
    skill: KoreanTestSkill;
  }>;
};

export function parseQuestionOptions(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

export function buildPublicKoreanChapterTest(
  test: CourseTestRow,
  questions: CourseTestQuestionRow[]
): PublicKoreanChapterTest {
  return {
    slug: test.slug,
    chapterNumber: test.chapter_number,
    title: test.title,
    koreanTitle: test.korean_title,
    description: test.description,
    durationMinutes: test.duration_minutes,
    passingScore: test.passing_score,
    skills: (test.skills ?? {}) as Partial<Record<KoreanTestSkill, string>>,
    questions: questions
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((question) => ({
        id: question.question_key,
        prompt: question.prompt,
        options: parseQuestionOptions(question.options),
        skill: question.skill as KoreanTestSkill,
      })),
  };
}
