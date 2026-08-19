import type { KnowledgeInteractionType } from "@/app/dashboard/progress/KnowledgeInteractionLab";
import type { StudentChapterPracticeProgress } from "./types";

export type StudentPracticeProgressCache = {
  progress: StudentChapterPracticeProgress;
  pending: boolean;
  masteredInteractions: KnowledgeInteractionType[];
};

const INTERACTION_TYPES = new Set<KnowledgeInteractionType>([
  "assemble",
  "deconstruct",
  "repair",
  "classify",
]);

export function readStudentPracticeProgressCache(cacheKey: string) {
  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StudentPracticeProgressCache>;
    const progress = parsed.progress;
    if (
      !progress ||
      typeof progress.practiceUnitId !== "string" ||
      !Array.isArray(progress.completedBlockIds)
    ) {
      return null;
    }
    return {
      progress,
      pending: Boolean(parsed.pending),
      masteredInteractions: Array.isArray(parsed.masteredInteractions)
        ? parsed.masteredInteractions.filter(
            (item): item is KnowledgeInteractionType =>
              INTERACTION_TYPES.has(item as KnowledgeInteractionType),
          )
        : [],
    } satisfies StudentPracticeProgressCache;
  } catch {
    return null;
  }
}

export function writeStudentPracticeProgressCache(
  cacheKey: string,
  cache: StudentPracticeProgressCache,
) {
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(cache));
  } catch {
    // 无痕模式或存储配额不足时仍保留当前会话状态。
  }
}

export function readLegacyInteractionProgress(chapterSlug: string) {
  try {
    const raw = window.localStorage.getItem(
      `knowledge-workbench-progress:${chapterSlug}`,
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      masteredInteractions?: KnowledgeInteractionType[];
    };
    return Array.isArray(parsed.masteredInteractions)
      ? parsed.masteredInteractions.filter((item) => INTERACTION_TYPES.has(item))
      : [];
  } catch {
    return [];
  }
}
