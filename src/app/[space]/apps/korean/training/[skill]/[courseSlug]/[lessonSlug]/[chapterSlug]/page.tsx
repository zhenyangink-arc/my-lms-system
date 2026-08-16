import { ToolboxSkillPage } from "@/app/dashboard/toolbox/[skill]/page-content";

export default function KoreanDedicatedSkillTrainingPage({
  params,
}: {
  params: Promise<{
    space: string;
    skill: string;
    courseSlug: string;
    lessonSlug: string;
    chapterSlug: string;
  }>;
}) {
  return (
    <ToolboxSkillPage
      params={params.then(({ space, skill }) => ({ space, skill }))}
      searchParams={params.then(({ courseSlug, lessonSlug, chapterSlug }) => ({
        course: courseSlug,
        lesson: lessonSlug,
        chapter: chapterSlug,
      }))}
      skillsBasePath="/dashboard/practice/skills"
      exerciseBasePath="/dashboard/training"
      renderExercisePage
    />
  );
}
