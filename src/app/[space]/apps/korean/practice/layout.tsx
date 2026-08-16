import type { ReactNode } from "react";

import { PracticeHubNavigation } from "@/app/dashboard/practice/PracticeHubNavigation";
import { PracticeSectionIntro } from "@/app/dashboard/practice/PracticeSectionIntro";
import { getStudentAppPath } from "@/lib/student-apps";

export default async function KoreanPracticeLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ space: string }>;
}) {
  const { space } = await params;
  const practiceBasePath = getStudentAppPath(space, "korean", "practice");

  return (
    <>
      <PracticeHubNavigation basePath={practiceBasePath} />
      <PracticeSectionIntro basePath={practiceBasePath} />
      {children}
    </>
  );
}
