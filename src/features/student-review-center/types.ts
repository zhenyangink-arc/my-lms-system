export type StudentReviewStatus = "pending" | "reviewing" | "mastered";

export type StudentReviewItem = {
  id: string;
  sourceType: string;
  sourceId: string;
  sourceQuestionId: string | null;
  courseId: string | null;
  courseChapterId: string | null;
  courseTitle: string | null;
  courseSlug: string | null;
  lessonSlug: string | null;
  chapterTitle: string | null;
  chapterSlug: string | null;
  skill: string;
  contentSnapshot: Record<string, unknown>;
  studentAnswerSnapshot: Record<string, unknown>;
  feedbackSnapshot: Record<string, unknown>;
  errorCount: number;
  status: StudentReviewStatus;
  lastReviewedAt: string | null;
  masteredAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudentReviewCenterResult = {
  items: StudentReviewItem[];
  error: string | null;
};
