import type { ReactNode } from "react";

import { AssessmentWorkspaceLayout } from "@/app/dashboard/assignments/AssessmentWorkspaceLayout";
import { getDashboardBasePath } from "@/lib/dashboard-path";

export default async function KoreanChapterTestLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ space: string; testSlug: string }>;
}) {
  const { space } = await params;
  const dashboardBasePath = getDashboardBasePath(
    space === "platform" ? null : space,
  );

  return (
    <AssessmentWorkspaceLayout
      dashboardBasePath={dashboardBasePath}
      section="chapter_test"
    >
      {children}
    </AssessmentWorkspaceLayout>
  );
}
