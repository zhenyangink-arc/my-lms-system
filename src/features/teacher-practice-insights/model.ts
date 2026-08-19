export const PRACTICE_SKILLS = [
  "listening",
  "speaking",
  "reading",
  "writing",
  "grammar",
  "vocabulary",
] as const;

export type PracticeSkill = (typeof PRACTICE_SKILLS)[number];
export type ReviewStatus = "pending" | "reviewing" | "mastered";

export const PRACTICE_SKILL_LABELS: Record<PracticeSkill, string> = {
  listening: "听力",
  speaking: "口语",
  reading: "阅读",
  writing: "写作",
  grammar: "语法",
  vocabulary: "词汇",
};

export type TeacherReviewEvidence = {
  studentId: string;
  courseId: string | null;
  courseChapterId: string | null;
  chapterTitle: string | null;
  skill: PracticeSkill;
  sourceType: string;
  status: ReviewStatus;
  errorCount: number;
  feedbackSnapshot?: Record<string, unknown>;
};

export type TeacherProgressEvidence = {
  studentId: string;
  courseId: string;
  courseTitle: string;
  courseSlug: string | null;
  courseChapterId: string;
  chapterTitle: string;
  chapterSlug: string | null;
  status:
    | "not_started"
    | "in_progress"
    | "needs_reinforcement"
    | "mastered"
    | "locked"
    | "content_preparing";
  progressPercent: number;
  masteryPercent: number;
  lastPracticedAt: string | null;
};

export type WeaknessSummary = {
  key: string;
  label: string;
  errorCount: number;
  unmasteredCount: number;
  affectedStudentCount: number;
};

export type NextStepSuggestion = {
  text: string;
  skill: PracticeSkill | null;
  chapterId: string | null;
  chapterTitle: string | null;
};

function safeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

/**
 * 先按路线图冻结的维度压平重复来源，再用于班级/个人聚合。
 */
export function groupReviewEvidence(items: TeacherReviewEvidence[]) {
  const grouped = new Map<string, TeacherReviewEvidence>();

  for (const item of items) {
    const key = [
      item.studentId,
      item.courseId ?? "none",
      item.courseChapterId ?? "none",
      item.skill,
      item.sourceType,
      item.status,
    ].join(":");
    const current = grouped.get(key);
    if (current) {
      current.errorCount += safeCount(item.errorCount);
    } else {
      grouped.set(key, { ...item, errorCount: safeCount(item.errorCount) });
    }
  }

  return [...grouped.values()];
}

function sortWeaknesses(items: WeaknessSummary[]) {
  return items.sort(
    (left, right) =>
      right.errorCount - left.errorCount ||
      right.unmasteredCount - left.unmasteredCount ||
      left.label.localeCompare(right.label, "zh-CN"),
  );
}

export function aggregateSkillWeaknesses(
  items: TeacherReviewEvidence[],
): WeaknessSummary[] {
  const grouped = groupReviewEvidence(items);
  return sortWeaknesses(
    PRACTICE_SKILLS.map((skill) => {
      const matching = grouped.filter(
        (item) => item.skill === skill && item.status !== "mastered",
      );
      return {
        key: skill,
        label: PRACTICE_SKILL_LABELS[skill],
        errorCount: matching.reduce((sum, item) => sum + item.errorCount, 0),
        unmasteredCount: matching.length,
        affectedStudentCount: new Set(matching.map((item) => item.studentId)).size,
      };
    }).filter((item) => item.errorCount > 0 || item.unmasteredCount > 0),
  );
}

export function aggregateChapterWeaknesses(
  items: TeacherReviewEvidence[],
): WeaknessSummary[] {
  const grouped = groupReviewEvidence(items).filter(
    (item) => item.courseChapterId && item.status !== "mastered",
  );
  const byChapter = new Map<string, TeacherReviewEvidence[]>();

  for (const item of grouped) {
    const chapterId = item.courseChapterId!;
    const list = byChapter.get(chapterId) ?? [];
    list.push(item);
    byChapter.set(chapterId, list);
  }

  return sortWeaknesses(
    [...byChapter.entries()].map(([chapterId, matching]) => ({
      key: chapterId,
      label: matching.find((item) => item.chapterTitle)?.chapterTitle ?? "未关联章节",
      errorCount: matching.reduce((sum, item) => sum + item.errorCount, 0),
      unmasteredCount: matching.length,
      affectedStudentCount: new Set(matching.map((item) => item.studentId)).size,
    })),
  );
}

function improvementTask(items: TeacherReviewEvidence[]) {
  for (const item of items) {
    const task = item.feedbackSnapshot?.improvementTask;
    if (typeof task === "string" && task.trim()) return task.trim();
  }
  return null;
}

export function buildNextStepSuggestion(
  progress: TeacherProgressEvidence[],
  reviewItems: TeacherReviewEvidence[],
): NextStepSuggestion {
  const skill = aggregateSkillWeaknesses(reviewItems)[0] ?? null;
  const chapter = aggregateChapterWeaknesses(reviewItems)[0] ?? null;
  const task = improvementTask(
    reviewItems.filter((item) => item.status !== "mastered"),
  );

  if (skill || chapter) {
    const evidence = [
      skill
        ? `${skill.label}有 ${skill.errorCount} 次未掌握错误`
        : null,
      chapter
        ? `「${chapter.label}」集中 ${chapter.errorCount} 次未掌握错误`
        : null,
    ].filter(Boolean);
    const action = [
      chapter ? `先复习「${chapter.label}」` : null,
      skill ? `再完成${skill.label}专项训练` : null,
      task ? `按老师反馈完成：${task}` : null,
    ].filter(Boolean);

    return {
      text: `真实复习数据表明：${evidence.join("，")}。建议${action.join("，")}。`,
      skill: (skill?.key as PracticeSkill | undefined) ?? null,
      chapterId: chapter?.key ?? null,
      chapterTitle: chapter?.label ?? null,
    };
  }

  const weakestProgress = [...progress]
    .filter((item) => item.status !== "mastered")
    .sort(
      (left, right) =>
        left.masteryPercent - right.masteryPercent ||
        left.progressPercent - right.progressPercent,
    )[0];
  if (weakestProgress) {
    return {
      text: `该生暂无未掌握错题；「${weakestProgress.chapterTitle}」当前掌握度为 ${Math.round(weakestProgress.masteryPercent)}%，建议先补完本章巩固内容。`,
      skill: null,
      chapterId: weakestProgress.courseChapterId,
      chapterTitle: weakestProgress.chapterTitle,
    };
  }

  return {
    text: "暂无可用于判断的巩固进度或未掌握错题，暂不生成训练建议。",
    skill: null,
    chapterId: null,
    chapterTitle: null,
  };
}
