import { getUnlockedChapterSlugs, isCourseUnlocked, isLessonUnlocked, type CourseUnlockRule, type LessonUnlockRule, type ChapterUnlockRule } from "./course-unlocks.ts";

type Course = CourseUnlockRule & { category_id: string; is_published: boolean };
type Lesson = LessonUnlockRule & { course_id: string; is_published: boolean };
type Chapter = ChapterUnlockRule & { lesson_id: string; chapter_test_id: string | null; is_published: boolean };

/** Same unlock evaluators as student training. No owner bypass is applied to the selected student. */
export function evaluateStudentChapterAccess(input: {
  courses: Course[]; lessons: Lesson[]; chapters: Chapter[];
  lessonId: string; chapterTestId: string | null;
  completedLessonIds: ReadonlySet<string>; passedChapterSlugs: ReadonlySet<string>; now: Date;
}) {
  const lesson = input.lessons.find(item => item.id === input.lessonId);
  const course = input.courses.find(item => item.id === lesson?.course_id);
  if (!course || !lesson) return { matched: false, published: false, courseOpen: false, lessonOpen: false, chapterOpen: false };
  const matches = input.chapterTestId ? input.chapters.filter(item => item.lesson_id === lesson.id && item.chapter_test_id === input.chapterTestId) : [];
  const courses = input.courses.filter(item => item.is_published);
  const lessons = input.lessons.filter(item => item.is_published);
  const completedCourses = new Set(courses.filter(item => {
    const rows = lessons.filter(row => row.course_id === item.id);
    return rows.length > 0 && rows.every(row => input.completedLessonIds.has(row.id));
  }).map(item => item.id));
  const orderedCourses = courses.filter(item => item.category_id === course.category_id);
  const orderedLessons = lessons.filter(item => item.course_id === course.id);
  const courseOpen = isCourseUnlocked({ course, courseIndex: orderedCourses.findIndex(item => item.id === course.id), orderedCourses, completedCourseIds: completedCourses, now: input.now });
  const lessonOpen = isLessonUnlocked({ lesson, lessonIndex: orderedLessons.findIndex(item => item.id === lesson.id), orderedLessons, completedLessonIds: input.completedLessonIds,
    prerequisiteChapterSlugById: new Map(input.chapters.map(item => [item.id, item.slug])), passedChapterSlugs: input.passedChapterSlugs, now: input.now });
  const chapters = getUnlockedChapterSlugs({ chapters: input.chapters.filter(item => item.lesson_id === lesson.id && item.is_published), passedChapterSlugs: input.passedChapterSlugs, now: input.now });
  return { matched: matches.length === 1, published: Boolean(course.is_published && lesson.is_published && matches.length === 1 && matches[0].is_published), courseOpen, lessonOpen, chapterOpen: matches.length === 1 && chapters.has(matches[0].slug) };
}
