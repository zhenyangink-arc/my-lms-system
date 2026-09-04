import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock3, LockKeyhole } from "lucide-react";

import { ChapterPracticeDetail } from "@/features/chapter-practice/components/chapter-practice-detail";
import { loadPublishedChapterPracticeUnit } from "@/features/chapter-practice/api/student-service";
import { loadStudentChapterPracticeProgress } from "@/features/chapter-practice/student/progress-service";
import { requireActiveUser } from "@/lib/auth";
import { loadCoursePracticeCatalog } from "@/lib/course-practice-catalog.server";
import { getStudentAppPath } from "@/lib/student-apps";

export default async function KoreanKnowledgeResearchLessonPage({
  params,
}: {
  params: Promise<{
    space: string;
    courseKey: string;
    chapterSlug: string;
  }>;
}) {
  const { space, courseKey, chapterSlug } = await params;
  const coursePracticePath = getStudentAppPath(
    space,
    "korean",
    "practice/course",
  );
  const { supabase, user } = await requireActiveUser();
  const courses = await loadCoursePracticeCatalog({ supabase, userId: user.id });
  const course = courses.find((item) => item.slug === courseKey);
  const chapter = course?.chapters.find((item) => item.slug === chapterSlug);

  if (!course || !chapter) notFound();

  if (!chapter.isOpen || !chapter.hasPublishedContent) {
    const isPreparing = chapter.isOpen && !chapter.hasPublishedContent;
    const StateIcon = isPreparing ? Clock3 : LockKeyhole;
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <section className="app-card rounded-3xl border p-8 text-center">
          <StateIcon className="mx-auto" size={32} aria-hidden="true" />
          <h1 className="mt-3 text-lg font-bold">
            {isPreparing ? "本章内容准备中" : "本章尚未开放"}
          </h1>
          <p className="app-muted-text mt-2 text-sm leading-6">
            {isPreparing
              ? "巩固内容发布后即可进入学习。"
              : "请先完成前置学习要求，或等待课程开放。"}
          </p>
          <Link
            href={coursePracticePath}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-bold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
            style={{ borderColor: "var(--border)", outlineColor: "var(--primary)" }}
          >
            返回课程巩固目录
          </Link>
        </section>
      </main>
    );
  }

  const practiceUnit = await loadPublishedChapterPracticeUnit({
    supabase,
    courseChapterId: chapter.id,
  });

  // 目录状态与详情查询之间可能恰逢版本切换。此时不回退到旧硬编码内容，
  // 而是明确显示准备状态，等待已发布版本重新可读。
  if (!practiceUnit) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <section className="app-card rounded-3xl border p-8 text-center">
          <Clock3 className="mx-auto" size={32} aria-hidden="true" />
          <h1 className="mt-3 text-lg font-bold">本章内容准备中</h1>
          <p className="app-muted-text mt-2 text-sm leading-6">
            当前已发布版本暂时无法读取，请稍后重新进入。
          </p>
          <Link
            href={coursePracticePath}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 text-sm font-bold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2"
            style={{ borderColor: "var(--border)", outlineColor: "var(--primary)" }}
          >
            返回课程巩固目录
          </Link>
        </section>
      </main>
    );
  }

  const initialProgress = await loadStudentChapterPracticeProgress({
    supabase,
    studentId: user.id,
    practiceUnitId: practiceUnit.id,
  });
  const linkedSkill = practiceUnit.blocks.find((block) =>
    ["listening", "speaking", "reading", "writing", "grammar", "vocabulary"].includes(
      block.blockType,
    ),
  )?.blockType;
  const skillsBasePath = getStudentAppPath(space, "korean", "practice/skills");
  const skillsHref = linkedSkill
    ? `${getStudentAppPath(space, "korean", "training")}/${encodeURIComponent(linkedSkill)}/${encodeURIComponent(course.slug)}/${encodeURIComponent(chapter.lessonSlug)}/${encodeURIComponent(chapter.slug)}`
    : skillsBasePath;

  return (
    <main className="mx-auto w-full max-w-[1680px] overflow-x-clip px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <ChapterPracticeDetail
        unit={practiceUnit}
        courseKey={course.slug}
        courseTitle={course.title}
        chapterNumber={chapter.number}
        chapterTitle={chapter.title}
        backHref={`${coursePracticePath}?course=${encodeURIComponent(course.slug)}`}
        chapterTestHref={getStudentAppPath(space, "korean", "assignments/korean")}
        skillsHref={skillsHref}
        reviewHref={getStudentAppPath(space, "korean", "practice/review")}
        chapterSlug={chapter.slug}
        cacheKey={`chapter-practice-progress:v1:${user.id}:${practiceUnit.id}`}
        initialProgress={initialProgress}
        chapterTestPassed={Boolean(chapter.attempt?.passed)}
        chapterTestAvailable={Boolean(chapter.chapter_test_id)}
      />
    </main>
  );
}
