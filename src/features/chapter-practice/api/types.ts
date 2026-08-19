export const CHAPTER_PRACTICE_SKILLS = [
  "listening",
  "speaking",
  "reading",
  "writing",
  "vocabulary",
  "grammar",
] as const;

export type ChapterPracticeSkill = (typeof CHAPTER_PRACTICE_SKILLS)[number];

export type ChapterPracticeUnitStatus =
  | "not_generated"
  | "draft"
  | "pending_review"
  | "published"
  | "needs_update"
  | "disabled";

export const CHAPTER_PRACTICE_BLOCK_TYPES = [
  "overview",
  "vocabulary",
  "grammar",
  "comparison",
  "listening",
  "speaking",
  "reading",
  "writing",
  "interaction",
  "review",
  "self_check",
] as const;

export type ChapterPracticeBlockType =
  (typeof CHAPTER_PRACTICE_BLOCK_TYPES)[number];

export type ChapterPracticeCompletionRule = {
  mode: "required_blocks";
  minimumRequiredBlocks: number;
  requireSelfCheck: boolean;
  minimumAccuracyPercent: number;
};

export type ChapterPracticeBlock = {
  id: string;
  practiceUnitId: string;
  blockType: ChapterPracticeBlockType;
  title: string;
  instructions: string;
  contentPayload: Record<string, unknown>;
  sourceType: string | null;
  sourceId: string | null;
  sortOrder: number;
  isRequired: boolean;
  status: ChapterPracticeUnitStatus;
  missingReasons: string[];
};

export type ChapterPracticeUnitDetail = {
  id: string;
  studentAppId: string;
  courseChapterId: string;
  sourceTextbookChapterId: string | null;
  version: number;
  status: ChapterPracticeUnitStatus;
  title: string;
  completionRule: ChapterPracticeCompletionRule;
  sourceSnapshot: Record<string, unknown>;
  publishedAt: string | null;
  updatedAt: string;
  courseTitle: string;
  lessonTitle: string;
  chapterTitle: string;
  blocks: ChapterPracticeBlock[];
};

export type ChapterPracticePublishCheck = {
  code: string;
  label: string;
  passed: boolean;
  reasons: string[];
};

export type ChapterPracticePublishInspection = {
  passed: boolean;
  checks: ChapterPracticePublishCheck[];
};

export type CoverageCourseRow = {
  id: string;
  slug: string;
  title: string;
  is_published: boolean;
  sort_order: number;
};

export type CoverageLessonRow = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  is_published: boolean;
  sort_order: number;
};

export type CoverageChapterRow = {
  id: string;
  lesson_id: string;
  chapter_test_id: string | null;
  slug: string;
  title: string;
  is_published: boolean;
  sort_order: number;
};

export type CoverageChapterTestRow = {
  id: string;
  status: string;
};

export type CoverageTextbookRow = {
  id: string;
  lesson_id: string;
  status: string;
};

export type CoverageTextbookVersionRow = {
  id: string;
  textbook_id: string;
  version_number: number;
  status: string;
};

export type CoverageTextbookChapterRow = {
  id: string;
  version_id: string;
  chapter_test_id: string | null;
  status: string;
  updated_at: string;
};

export type CoverageTextbookModuleRow = {
  id: string;
  chapter_id: string;
  module_code: string;
};

export type CoverageTextbookNodeRow = {
  module_id: string;
  content: Record<string, unknown> | null;
};

export type CoverageExerciseRow = {
  chapter_test_id: string | null;
  skill: string;
  status: string;
};

export type CoverageHomeworkRow = {
  test_id: string;
  status: string;
};

export type CoveragePracticeUnitRow = {
  id: string;
  course_chapter_id: string;
  version: number;
  status: ChapterPracticeUnitStatus;
  updated_at: string;
};

export type ChapterPracticeCoverageSource = {
  courses: CoverageCourseRow[];
  lessons: CoverageLessonRow[];
  chapters: CoverageChapterRow[];
  chapterTests: CoverageChapterTestRow[];
  textbooks: CoverageTextbookRow[];
  textbookVersions: CoverageTextbookVersionRow[];
  textbookChapters: CoverageTextbookChapterRow[];
  textbookModules: CoverageTextbookModuleRow[];
  textbookNodes: CoverageTextbookNodeRow[];
  exercises: CoverageExerciseRow[];
  homeworkPlans: CoverageHomeworkRow[];
  practiceUnits: CoveragePracticeUnitRow[];
};

export type ChapterPracticeCoverageRow = {
  id: string;
  course: {
    id: string;
    slug: string;
    title: string;
    isPublished: boolean;
  };
  lesson: {
    id: string;
    slug: string;
    title: string;
    isPublished: boolean;
  };
  chapter: {
    id: string;
    slug: string;
    title: string;
    isPublished: boolean;
  };
  textbook: {
    isPublished: boolean;
    vocabularyCount: number;
    grammarCount: number;
  };
  skills: Record<ChapterPracticeSkill, boolean>;
  homeworkPublished: boolean;
  chapterTestPublished: boolean;
  practice: {
    unitId: string | null;
    isGenerated: boolean;
    version: number | null;
    status: ChapterPracticeUnitStatus;
    lastSyncedAt: string | null;
    needsUpdate: boolean;
  };
};

export type ChapterPracticeCoverageResult = {
  rows: ChapterPracticeCoverageRow[];
  courseCount: number;
  lessonCount: number;
  chapterCount: number;
  generatedCount: number;
  needsUpdateCount: number;
};
