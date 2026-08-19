import {
  CHAPTER_PRACTICE_SKILLS,
  type ChapterPracticeCoverageResult,
  type ChapterPracticeCoverageSource,
  type ChapterPracticeSkill,
  type CoveragePracticeUnitRow,
  type CoverageTextbookChapterRow,
} from "./types.ts";

function byOrderThenId<T extends { sort_order: number; id: string }>(
  left: T,
  right: T,
) {
  return left.sort_order - right.sort_order || left.id.localeCompare(right.id);
}

function contentItemCount(
  content: Record<string, unknown> | null,
  key: "vocabulary" | "grammar",
) {
  const items = content?.[key];
  if (!Array.isArray(items)) return 0;

  return items.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    if (key === "vocabulary") return Boolean(record.ko || record.zh);
    return Boolean(record.title);
  }).length;
}

function newestPracticeUnit(
  units: CoveragePracticeUnitRow[],
): CoveragePracticeUnitRow | null {
  return units.toSorted(
    (left, right) =>
      right.version - left.version ||
      right.updated_at.localeCompare(left.updated_at),
  )[0] ?? null;
}

function latestTextbookChapter(
  chapters: CoverageTextbookChapterRow[],
  versionNumberById: ReadonlyMap<string, number>,
) {
  return chapters.toSorted(
    (left, right) =>
      (versionNumberById.get(right.version_id) ?? 0) -
        (versionNumberById.get(left.version_id) ?? 0) ||
      right.updated_at.localeCompare(left.updated_at) ||
      right.id.localeCompare(left.id),
  )[0] ?? null;
}

export function buildChapterPracticeCoverage(
  source: ChapterPracticeCoverageSource,
): ChapterPracticeCoverageResult {
  const courses = source.courses.toSorted(byOrderThenId);
  const lessons = source.lessons.toSorted(byOrderThenId);
  const chapters = source.chapters;
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const orderedChapters = courses.flatMap((course) =>
    lessons
      .filter((lesson) => lesson.course_id === course.id)
      .flatMap((lesson) =>
        chapters
          .filter((chapter) => chapter.lesson_id === lesson.id)
          .toSorted(byOrderThenId),
      ),
  );
  const testStatusById = new Map(
    source.chapterTests.map((test) => [test.id, test.status]),
  );
  const textbookById = new Map(
    source.textbooks.map((textbook) => [textbook.id, textbook]),
  );
  const versionById = new Map(
    source.textbookVersions.map((version) => [version.id, version]),
  );
  const versionNumberById = new Map(
    source.textbookVersions.map((version) => [
      version.id,
      version.version_number,
    ]),
  );
  const modulesByChapterId = new Map<
    string,
    ChapterPracticeCoverageSource["textbookModules"]
  >();
  for (const textbookModule of source.textbookModules) {
    const siblings = modulesByChapterId.get(textbookModule.chapter_id) ?? [];
    siblings.push(textbookModule);
    modulesByChapterId.set(textbookModule.chapter_id, siblings);
  }
  const nodesByModuleId = new Map<
    string,
    ChapterPracticeCoverageSource["textbookNodes"]
  >();
  for (const node of source.textbookNodes) {
    const siblings = nodesByModuleId.get(node.module_id) ?? [];
    siblings.push(node);
    nodesByModuleId.set(node.module_id, siblings);
  }
  const textbookChaptersByTestId = new Map<
    string,
    CoverageTextbookChapterRow[]
  >();
  for (const chapter of source.textbookChapters) {
    if (!chapter.chapter_test_id) continue;
    const siblings =
      textbookChaptersByTestId.get(chapter.chapter_test_id) ?? [];
    siblings.push(chapter);
    textbookChaptersByTestId.set(chapter.chapter_test_id, siblings);
  }
  const publishedSkillsByTestId = new Map<
    string,
    Set<ChapterPracticeSkill>
  >();
  for (const exercise of source.exercises) {
    if (
      !exercise.chapter_test_id ||
      exercise.status !== "published" ||
      !CHAPTER_PRACTICE_SKILLS.includes(exercise.skill as ChapterPracticeSkill)
    ) {
      continue;
    }
    const skills =
      publishedSkillsByTestId.get(exercise.chapter_test_id) ?? new Set();
    skills.add(exercise.skill as ChapterPracticeSkill);
    publishedSkillsByTestId.set(exercise.chapter_test_id, skills);
  }
  const publishedHomeworkTestIds = new Set(
    source.homeworkPlans
      .filter((plan) => plan.status === "published")
      .map((plan) => plan.test_id),
  );
  const practiceUnitsByChapterId = new Map<string, CoveragePracticeUnitRow[]>();
  for (const unit of source.practiceUnits) {
    const versions = practiceUnitsByChapterId.get(unit.course_chapter_id) ?? [];
    versions.push(unit);
    practiceUnitsByChapterId.set(unit.course_chapter_id, versions);
  }

  const rows = orderedChapters.flatMap((chapter) => {
    const lesson = lessonById.get(chapter.lesson_id);
    const course = lesson ? courseById.get(lesson.course_id) : null;
    if (!lesson || !course) return [];

    const chapterTestId = chapter.chapter_test_id;
    const textbookCandidates = chapterTestId
      ? (textbookChaptersByTestId.get(chapterTestId) ?? [])
      : [];
    const selectedTextbookChapter = latestTextbookChapter(
      textbookCandidates,
      versionNumberById,
    );
    const textbookPublished = textbookCandidates.some((candidate) => {
      const version = versionById.get(candidate.version_id);
      const textbook = version
        ? textbookById.get(version.textbook_id)
        : undefined;
      return (
        candidate.status === "published" &&
        version?.status === "published" &&
        textbook?.status === "published"
      );
    });
    const selectedModules = selectedTextbookChapter
      ? (modulesByChapterId.get(selectedTextbookChapter.id) ?? [])
      : [];
    const countModuleItems = (moduleCode: "vocabulary" | "grammar") =>
      selectedModules
        .filter((module) => module.module_code === moduleCode)
        .reduce(
          (moduleTotal, module) =>
            moduleTotal +
            (nodesByModuleId.get(module.id) ?? []).reduce(
              (nodeTotal, node) =>
                nodeTotal + contentItemCount(node.content, moduleCode),
              0,
            ),
          0,
        );
    const publishedSkills = chapterTestId
      ? publishedSkillsByTestId.get(chapterTestId)
      : undefined;
    const latestUnit = newestPracticeUnit(
      practiceUnitsByChapterId.get(chapter.id) ?? [],
    );

    return [
      {
        id: chapter.id,
        course: {
          id: course.id,
          slug: course.slug,
          title: course.title,
          isPublished: course.is_published,
        },
        lesson: {
          id: lesson.id,
          slug: lesson.slug,
          title: lesson.title,
          isPublished: lesson.is_published,
        },
        chapter: {
          id: chapter.id,
          slug: chapter.slug,
          title: chapter.title,
          isPublished: chapter.is_published,
        },
        textbook: {
          isPublished: textbookPublished,
          vocabularyCount: countModuleItems("vocabulary"),
          grammarCount: countModuleItems("grammar"),
        },
        skills: Object.fromEntries(
          CHAPTER_PRACTICE_SKILLS.map((skill) => [
            skill,
            publishedSkills?.has(skill) ?? false,
          ]),
        ) as Record<ChapterPracticeSkill, boolean>,
        homeworkPublished: chapterTestId
          ? publishedHomeworkTestIds.has(chapterTestId)
          : false,
        chapterTestPublished: chapterTestId
          ? testStatusById.get(chapterTestId) === "published"
          : false,
        practice: latestUnit
          ? {
              unitId: latestUnit.id,
              isGenerated: latestUnit.status !== "not_generated",
              version: latestUnit.version,
              status: latestUnit.status,
              lastSyncedAt: latestUnit.updated_at,
              needsUpdate: latestUnit.status === "needs_update",
            }
          : {
              unitId: null,
              isGenerated: false,
              version: null,
              status: "not_generated" as const,
              lastSyncedAt: null,
              needsUpdate: false,
            },
      },
    ];
  });

  return {
    rows,
    courseCount: courses.length,
    lessonCount: lessons.length,
    chapterCount: rows.length,
    generatedCount: rows.filter((row) => row.practice.isGenerated).length,
    needsUpdateCount: rows.filter((row) => row.practice.needsUpdate).length,
  };
}
