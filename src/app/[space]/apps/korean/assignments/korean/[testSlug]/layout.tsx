import type { ReactNode } from "react";

import { AssessmentWorkspaceLayout } from "@/app/dashboard/assignments/AssessmentWorkspaceLayout";
import { getStudentAppBasePath } from "@/lib/student-apps";

export default async function KoreanChapterTestLayout({ children, params }: { children: ReactNode; params: Promise<{ space: string }> }) {
  const { space } = await params;
  return <AssessmentWorkspaceLayout dashboardBasePath={getStudentAppBasePath(space, "korean")} section="chapter_test">{children}</AssessmentWorkspaceLayout>;
}

