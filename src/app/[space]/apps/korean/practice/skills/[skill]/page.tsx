import { ToolboxSkillPage } from "@/app/dashboard/toolbox/[skill]/page-content";

export default function KoreanSkillPracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ space: string; skill: string }>;
  searchParams: Promise<{ course?: string; lesson?: string; chapter?: string }>;
}) {
  return (
    <ToolboxSkillPage
      params={params}
      searchParams={searchParams}
      skillsBasePath="/dashboard/practice/skills"
    />
  );
}
