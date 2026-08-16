import { ToolboxSkillPage } from "@/app/dashboard/toolbox/[skill]/page-content";

export default function KoreanVocabularyPracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ space: string }>;
  searchParams: Promise<{ course?: string; lesson?: string; chapter?: string }>;
}) {
  return (
    <ToolboxSkillPage
      params={params.then(({ space }) => ({ space, skill: "vocabulary" }))}
      searchParams={searchParams}
      skillsBasePath="/dashboard/practice/skills"
    />
  );
}
