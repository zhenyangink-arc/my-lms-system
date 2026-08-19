export type PublishedChapterPracticeBlock = {
  id: string;
  practiceUnitId: string;
  blockType: string;
  title: string;
  instructions: string;
  contentPayload: Record<string, unknown>;
  sourceType: string | null;
  sourceId: string | null;
  sortOrder: number;
  isRequired: boolean;
};

export type PublishedChapterPracticeUnit = {
  id: string;
  courseChapterId: string;
  version: number;
  title: string;
  completionRule: Record<string, unknown>;
  publishedAt: string;
  blocks: PublishedChapterPracticeBlock[];
};

export type ChapterPracticeSelfCheckResult = {
  score: number;
  passingScore: number;
  passed: boolean;
  masteredCount: number;
  topicCount: number;
};

export type ChapterPracticeProgressStatus =
  | "not_started"
  | "in_progress"
  | "needs_reinforcement"
  | "mastered";

export type StudentChapterPracticeProgress = {
  practiceUnitId: string;
  status: ChapterPracticeProgressStatus;
  progressPercent: number;
  masteryPercent: number;
  completedBlockIds: string[];
  lastBlockId: string | null;
  correctCount: number;
  attemptCount: number;
  startedAt: string | null;
  lastPracticedAt: string | null;
  completedAt: string | null;
};
