export type GuideAgentHighlightTarget = {
  elementId: string;
  path?: string;
};

const BEGINNER_COURSE_PATH =
  "/dashboard/courses/korean/korean-basic/korean-beginner/hangul-introduction";
const REVIEW_QUESTIONS_PATH =
  "/dashboard/progress?area=review#guide-target-review-questions";

const navigationAliases: Record<string, string> = {
  成长首页: "/dashboard",
  错题本: REVIEW_QUESTIONS_PATH,
  待复习: REVIEW_QUESTIONS_PATH,
  待复习题: REVIEW_QUESTIONS_PATH,
  review: REVIEW_QUESTIONS_PATH,
  reviewquestions: REVIEW_QUESTIONS_PATH,
  wronganswerbook: REVIEW_QUESTIONS_PATH,
  入门课程: BEGINNER_COURSE_PATH,
  基础入门课程: BEGINNER_COURSE_PATH,
  韩文字母入门: BEGINNER_COURSE_PATH,
  韩语字母入门: BEGINNER_COURSE_PATH,
  beginnerintro: BEGINNER_COURSE_PATH,
  beginnercourse: BEGINNER_COURSE_PATH,
  hangulintroduction: BEGINNER_COURSE_PATH,
  课程中心: "/dashboard/courses",
  我的课程: "/dashboard/courses",
  courses: "/dashboard/courses",
  深化学习: "/dashboard/progress",
  学习进度: "/dashboard/progress",
  progress: "/dashboard/progress",
  章节测试: "/dashboard/assignments/korean",
  chaptertests: "/dashboard/assignments/korean",
  作业与考试: "/dashboard/assignments",
  assignments: "/dashboard/assignments",
  大学中心: "/dashboard/universities",
  universities: "/dashboard/universities",
  目标大学: "/dashboard/universities/targets",
  targetuniversity: "/dashboard/universities/targets",
  targetuniversities: "/dashboard/universities/targets",
  universitytargets: "/dashboard/universities/targets",
  大学库: "/dashboard/universities/library",
  universitylibrary: "/dashboard/universities/library",
  通知提醒: "/dashboard#reminders",
  reminders: "/dashboard#reminders",
};

const highlightAliases: Record<string, GuideAgentHighlightTarget> = {
  错题本: {
    elementId: "guide-target-review-questions",
    path: REVIEW_QUESTIONS_PATH,
  },
  待复习题: {
    elementId: "guide-target-review-questions",
    path: REVIEW_QUESTIONS_PATH,
  },
  待复习: {
    elementId: "guide-target-review-questions",
    path: REVIEW_QUESTIONS_PATH,
  },
  reviewquestions: {
    elementId: "guide-target-review-questions",
    path: REVIEW_QUESTIONS_PATH,
  },
  pendingreviewarea: {
    elementId: "guide-target-review-questions",
    path: REVIEW_QUESTIONS_PATH,
  },
  reviewarea: {
    elementId: "guide-target-review-questions",
    path: REVIEW_QUESTIONS_PATH,
  },
  入门课程: {
    elementId: "guide-target-beginner-course",
    path: `${BEGINNER_COURSE_PATH}#guide-target-beginner-course`,
  },
  基础入门课程: {
    elementId: "guide-target-beginner-course",
    path: `${BEGINNER_COURSE_PATH}#guide-target-beginner-course`,
  },
  beginnerintro: {
    elementId: "guide-target-beginner-course",
    path: `${BEGINNER_COURSE_PATH}#guide-target-beginner-course`,
  },
  beginnercourse: {
    elementId: "guide-target-beginner-course",
    path: `${BEGINNER_COURSE_PATH}#guide-target-beginner-course`,
  },
  hangulintroduction: {
    elementId: "guide-target-beginner-course",
    path: `${BEGINNER_COURSE_PATH}#guide-target-beginner-course`,
  },
  通知提醒: {
    elementId: "reminders",
    path: "/dashboard#reminders",
  },
  reminders: {
    elementId: "reminders",
    path: "/dashboard#reminders",
  },
};

function normalizeAlias(value: string) {
  return value.trim().toLowerCase().replace(/[\s_#-]+/g, "");
}

function resolveKeywordAlias<T>(
  target: string,
  aliases: Record<string, T>,
): T | null {
  const normalizedTarget = normalizeAlias(target);
  const exactMatch = aliases[normalizedTarget];

  if (exactMatch) return exactMatch;

  const keywordMatch = Object.entries(aliases)
    .map(([keyword, value]) => ({
      keyword: normalizeAlias(keyword),
      value,
    }))
    .filter(({ keyword }) => keyword.length > 0)
    .sort((left, right) => right.keyword.length - left.keyword.length)
    .find(({ keyword }) => normalizedTarget.includes(keyword));

  return keywordMatch?.value ?? null;
}

export function resolveGuideNavigationTarget(target: string) {
  const trimmedTarget = target.trim();

  if (/^\/dashboard(?:[/?#]|$)/.test(trimmedTarget)) {
    return trimmedTarget;
  }

  return resolveKeywordAlias(trimmedTarget, navigationAliases);
}

export function resolveGuideHighlightTarget(
  target: string,
): GuideAgentHighlightTarget | null {
  const trimmedTarget = target.trim();
  const aliasTarget = resolveKeywordAlias(trimmedTarget, highlightAliases);

  if (aliasTarget) return aliasTarget;

  const elementId = trimmedTarget.replace(/^#/, "");
  if (/^[A-Za-z][A-Za-z0-9:._-]{0,99}$/.test(elementId)) {
    return { elementId };
  }

  return null;
}
