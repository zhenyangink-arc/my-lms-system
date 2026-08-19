import { notFound } from "next/navigation";

import {
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";
import { loadTeacherClassTodaySnapshot } from "@/features/teacher-class-today/api/service";
import { TeacherClassTodayDashboard } from "@/features/teacher-class-today/components/teacher-class-today-dashboard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TeacherClassTodayRoute({
  params,
}: {
  params: Promise<{ space: string; appSlug: string }>;
}) {
  const { space, appSlug } = await params;
  const context = await requireManagementApplicationSection(
    space,
    appSlug,
    "class-today",
  );
  if (
    context.access.app.kind !== "learning" ||
    context.access.scope !== "tenant" ||
    context.access.role !== "teacher" ||
    !context.access.tenantId
  ) {
    notFound();
  }

  const supabase = await createClient();
  const snapshot = await loadTeacherClassTodaySnapshot({
    supabase,
    tenantId: context.access.tenantId,
    studentAppId: context.access.appId,
  });

  return (
    <ManagementApplicationSectionFrame {...context}>
      <TeacherClassTodayDashboard
        snapshot={snapshot}
        detailBasePath={`${context.access.appPath}/class-today`}
      />
    </ManagementApplicationSectionFrame>
  );
}
