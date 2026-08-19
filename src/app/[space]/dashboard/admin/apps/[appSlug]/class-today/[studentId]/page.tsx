import { notFound } from "next/navigation";

import {
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";
import {
  loadTeacherClassTodaySnapshot,
  TeacherClassTodayAccessError,
} from "@/features/teacher-class-today/api/service";
import { TeacherStudentTodayDetail } from "@/features/teacher-class-today/components/teacher-class-today-dashboard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function TeacherStudentTodayDetailRoute({
  params,
}: {
  params: Promise<{ space: string; appSlug: string; studentId: string }>;
}) {
  const { space, appSlug, studentId } = await params;
  if (!UUID_PATTERN.test(studentId)) notFound();

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
  let snapshot;
  try {
    snapshot = await loadTeacherClassTodaySnapshot({
      supabase,
      tenantId: context.access.tenantId,
      studentAppId: context.access.appId,
      studentId,
    });
  } catch (error) {
    if (error instanceof TeacherClassTodayAccessError) notFound();
    throw error;
  }
  if (snapshot.students.length !== 1) notFound();

  return (
    <ManagementApplicationSectionFrame {...context}>
      <TeacherStudentTodayDetail
        snapshot={snapshot}
        backHref={`${context.access.appPath}/class-today`}
      />
    </ManagementApplicationSectionFrame>
  );
}
