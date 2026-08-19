const KOREAN_APP_PATH = "apps/korean";

function segment(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? encodeURIComponent(normalized) : null;
}

function appPath(space: string, suffix: string): string {
  const spaceSegment = segment(space);
  if (!spaceSegment) return "/";
  return `/${spaceSegment}/${KOREAN_APP_PATH}/${suffix}`;
}

function appendSegments(basePath: string, routeSegments: string[]): string {
  return basePath === "/" ? basePath : `${basePath}/${routeSegments.join("/")}`;
}

export type CourseLearningLocation = {
  categorySlug?: string | null;
  subcategorySlug?: string | null;
  courseSlug?: string | null;
  lessonSlug?: string | null;
};

export type ChapterPracticeLocation = {
  courseKey?: string | null;
  chapterSlug?: string | null;
};

export type SpecializedPracticeLocation = {
  skill?: string | null;
  courseSlug?: string | null;
  lessonSlug?: string | null;
  chapterSlug?: string | null;
};

export type ReviewSourceLocation =
  | ({ sourceType: "assignment" } & { assignmentId?: string | null })
  | ({ sourceType: "exam" } & { examId?: string | null })
  | ({ sourceType: "chapter_practice" } & ChapterPracticeLocation)
  | ({ sourceType: "specialized_practice" } & SpecializedPracticeLocation);

export type TeacherRecommendationSourceLocation =
  | ({ sourceType: "course" } & CourseLearningLocation)
  | ({ sourceType: "chapter_practice" } & ChapterPracticeLocation)
  | ({ sourceType: "specialized_practice" } & SpecializedPracticeLocation)
  | { sourceType: "review" };

export type TeacherRecommendationLocation = {
  sourceType: "teacher_recommendation";
  recommendedSource: TeacherRecommendationSourceLocation;
};

export function getAssignmentDetailPath(
  space: string,
  assignmentId?: string | null,
): string {
  const id = segment(assignmentId);
  const basePath = appPath(space, "assignments");
  return id ? appendSegments(basePath, [id]) : basePath;
}

export function getExamDetailPath(
  space: string,
  examId?: string | null,
): string {
  return getAssignmentDetailPath(space, examId);
}

export function getChapterTestDetailPath(
  space: string,
  testSlug?: string | null,
): string {
  const slug = segment(testSlug);
  const basePath = appPath(space, "assignments/korean");
  return slug ? appendSegments(basePath, [slug]) : basePath;
}

export function getCourseLearningPath(
  space: string,
  location?: CourseLearningLocation | null,
): string {
  const basePath = appPath(space, "courses");
  const routeSegments = [
    segment(location?.categorySlug),
    segment(location?.subcategorySlug),
    segment(location?.courseSlug),
    segment(location?.lessonSlug),
  ];

  return routeSegments.every((value): value is string => value !== null)
    ? appendSegments(basePath, routeSegments)
    : basePath;
}

export function getChapterPracticePath(
  space: string,
  location?: ChapterPracticeLocation | null,
): string {
  const basePath = appPath(space, "practice/course");
  const courseKey = segment(location?.courseKey);
  const chapterSlug = segment(location?.chapterSlug);
  return courseKey && chapterSlug
    ? appendSegments(basePath, [courseKey, chapterSlug])
    : basePath;
}

export function getSpecializedPracticePath(
  space: string,
  location?: SpecializedPracticeLocation | null,
): string {
  const fallbackPath = appPath(space, "practice/skills");
  const routeSegments = [
    segment(location?.skill),
    segment(location?.courseSlug),
    segment(location?.lessonSlug),
    segment(location?.chapterSlug),
  ];

  return routeSegments.every((value): value is string => value !== null)
    ? appendSegments(appPath(space, "training"), routeSegments)
    : fallbackPath;
}

export function getReviewPath(space: string): string {
  return appPath(space, "practice/review");
}

/**
 * 老师推荐保留自身的聚合 sourceType，但 href 始终落到被推荐内容的真实业务页。
 * 这里复用既有构造器，避免推荐服务重新拼接学生端路由。
 */
export function getTeacherRecommendationPath(
  space: string,
  location: TeacherRecommendationSourceLocation | TeacherRecommendationLocation,
): string {
  const source = location.sourceType === "teacher_recommendation"
    ? location.recommendedSource
    : location;
  switch (source.sourceType) {
    case "course":
      return getCourseLearningPath(space, source);
    case "chapter_practice":
      return getChapterPracticePath(space, source);
    case "specialized_practice":
      return getSpecializedPracticePath(space, source);
    case "review":
      return getReviewPath(space);
  }
}

export function getReviewSourcePath(
  space: string,
  source?: ReviewSourceLocation | null,
): string {
  if (!source) return getReviewPath(space);

  switch (source.sourceType) {
    case "assignment":
      return getAssignmentDetailPath(space, source.assignmentId);
    case "exam":
      return getExamDetailPath(space, source.examId);
    case "chapter_practice":
      return getChapterPracticePath(space, source);
    case "specialized_practice":
      return getSpecializedPracticePath(space, source);
  }
}

export function getGradeFeedbackPath(
  space: string,
  assignmentId?: string | null,
): string {
  return segment(assignmentId)
    ? getAssignmentDetailPath(space, assignmentId)
    : appPath(space, "grades");
}
