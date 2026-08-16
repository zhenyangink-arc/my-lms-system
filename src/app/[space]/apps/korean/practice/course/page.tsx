import { redirect } from "next/navigation";

import { DeepLearningPage } from "@/app/dashboard/progress/page-content";
import { getStudentAppPath } from "@/lib/student-apps";

export default async function KoreanCoursePracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ space: string }>;
  searchParams: Promise<{
    area?: string;
    course?: string;
    chapter?: string;
  }>;
}) {
  const [{ space }, query] = await Promise.all([params, searchParams]);
  const coursePracticePath = getStudentAppPath(
    space,
    "korean",
    "practice/course",
  );

  if (query.course && query.chapter) {
    redirect(
      `${coursePracticePath}/${encodeURIComponent(query.course)}/${encodeURIComponent(query.chapter)}`,
    );
  }

  return (
    <DeepLearningPage
      searchParams={Promise.resolve(query)}
      forcedArea="knowledge"
      knowledgeChapterBaseHref={coursePracticePath}
    />
  );
}
