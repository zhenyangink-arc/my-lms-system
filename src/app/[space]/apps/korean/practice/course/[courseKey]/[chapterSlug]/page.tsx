import { DeepLearningPage } from "@/app/dashboard/progress/page-content";
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

  return (
    <DeepLearningPage
      searchParams={Promise.resolve({
        area: "knowledge",
        course: courseKey,
        chapter: chapterSlug,
      })}
      forcedArea="knowledge"
      knowledgeChapterBaseHref={coursePracticePath}
      knowledgeLessonOnly
    />
  );
}
