import { createHomeLearningTaskKey } from "../priority.ts";
import { getSpecializedPracticePath } from "../routes.ts";
import type { HomeLearningTask } from "./types.ts";

export const DEFAULT_WEAK_ABILITY_THRESHOLD = 70;
export const DEFAULT_RECENT_SESSION_MINIMUM = 2;
export const DEFAULT_CONSECUTIVE_LOW_SESSION_COUNT = 3;

const SKILL_LABELS: Record<string, string> = {
  listening: "听力",
  speaking: "口语",
  reading: "阅读",
  writing: "写作",
  grammar: "语法",
  vocabulary: "词汇",
};

export type SpecializedPracticeCandidate = {
  exerciseId: string;
  exerciseTitle: string;
  description: string | null;
  skill: string;
  abilityScore: number | null;
  recentSessionCount: number;
  consecutiveLowSessionCount: number;
  courseId: string;
  courseChapterId: string;
  courseSlug: string;
  lessonSlug: string;
  chapterSlug: string;
  isOpen: boolean;
  updatedAt: string;
};

type MapSpecializedPracticeTaskInput = {
  candidate: SpecializedPracticeCandidate;
  studentAppId: string;
  appSlug: string;
  appLabel: string;
  space: string;
  weakAbilityThreshold?: number;
  recentSessionMinimum?: number;
  consecutiveLowSessionMinimum?: number;
};

export function mapSpecializedPracticeTask({
  candidate,
  studentAppId,
  appSlug,
  appLabel,
  space,
  weakAbilityThreshold = DEFAULT_WEAK_ABILITY_THRESHOLD,
  recentSessionMinimum = DEFAULT_RECENT_SESSION_MINIMUM,
  consecutiveLowSessionMinimum = DEFAULT_CONSECUTIVE_LOW_SESSION_COUNT,
}: MapSpecializedPracticeTaskInput): HomeLearningTask | null {
  if (!candidate.isOpen) return null;
  const weakAbility =
    candidate.abilityScore !== null &&
    candidate.abilityScore < weakAbilityThreshold;
  const insufficientPractice = candidate.recentSessionCount < recentSessionMinimum;
  const consecutiveLoss =
    candidate.consecutiveLowSessionCount >= consecutiveLowSessionMinimum;
  if (!weakAbility && !insufficientPractice && !consecutiveLoss) return null;

  const skillLabel = SKILL_LABELS[candidate.skill] ?? candidate.skill;
  let reason: string;
  if (weakAbility) {
    reason = `${skillLabel}最近能力值为${Math.round(candidate.abilityScore!)}分，低于${weakAbilityThreshold}分建议线，建议完成一次专项训练。`;
  } else if (consecutiveLoss) {
    reason = `${skillLabel}最近连续${candidate.consecutiveLowSessionCount}次练习未达建议线，建议集中加强。`;
  } else {
    reason = `${skillLabel}最近30天只完成${candidate.recentSessionCount}次有效练习，建议补充一次专项训练。`;
  }

  return {
    taskKey: createHomeLearningTaskKey(
      studentAppId,
      "specialized_practice",
      candidate.exerciseId,
    ),
    studentAppId,
    appSlug,
    appLabel,
    sourceType: "specialized_practice",
    sourceId: candidate.exerciseId,
    title: candidate.exerciseTitle,
    description: candidate.description,
    status: "available",
    priority: "normal",
    required: false,
    startsAt: null,
    dueAt: null,
    progressPercent: null,
    reason,
    href: getSpecializedPracticePath(space, {
      skill: candidate.skill,
      courseSlug: candidate.courseSlug,
      lessonSlug: candidate.lessonSlug,
      chapterSlug: candidate.chapterSlug,
    }),
    courseId: candidate.courseId,
    courseChapterId: candidate.courseChapterId,
    skill: candidate.skill,
    updatedAt: candidate.updatedAt,
  };
}
