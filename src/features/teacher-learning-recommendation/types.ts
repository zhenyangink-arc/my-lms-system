export const TEACHER_RECOMMENDATION_SOURCE_TYPES = [
  "course",
  "chapter_practice",
  "specialized_practice",
  "review",
] as const;

export type TeacherRecommendationSourceType =
  (typeof TEACHER_RECOMMENDATION_SOURCE_TYPES)[number];

export type TeacherRecommendationTarget =
  | { targetScope: "class"; classId: string; studentId?: never }
  | { targetScope: "student"; studentId: string; classId?: never };

export type CreateTeacherLearningRecommendationInput =
  TeacherRecommendationTarget & {
    studentAppId: string;
    sourceType: TeacherRecommendationSourceType;
    sourceId: string;
    title: string;
    reason: string;
    isRequired: boolean;
    dueAt: string;
    /** 不传时立即开始；未来的排期入口可以传入开始时间。 */
    startsAt?: string;
  };

export type TeacherLearningRecommendation = {
  id: string;
  studentAppId: string;
  teacherId: string;
  target: TeacherRecommendationTarget;
  sourceType: TeacherRecommendationSourceType;
  sourceId: string;
  title: string;
  reason: string;
  isRequired: boolean;
  startsAt: string;
  dueAt: string;
  status: "active" | "withdrawn";
  href: string;
  createdAt: string;
  updatedAt: string;
};

export type TeacherRecommendationActionResult =
  | { ok: true; recommendation: TeacherLearningRecommendation }
  | { ok: false; message: string };
