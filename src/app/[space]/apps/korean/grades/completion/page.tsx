import { redirect } from "next/navigation";

import { StudentCompletionPage } from "@/features/course-completion/StudentCompletionPage";
import { getStudentCompletionData } from "@/features/course-completion/student-service";
import { requireActiveUser } from "@/lib/auth";
import { getGradeCenterAccess } from "@/lib/grade-center";

export default async function KoreanCompletionPage({
  params,
}: {
  params: Promise<{ space: string }>;
}) {
  const [{ space }, access, auth] = await Promise.all([
    params,
    getGradeCenterAccess(),
    requireActiveUser(),
  ]);

  if (access.role !== "student" || !access.tenantId) {
    redirect(`/${encodeURIComponent(space)}/apps/korean/grades`);
  }

  const data = await getStudentCompletionData({
    supabase: access.supabase,
    tenantId: access.tenantId,
    studentId: access.user.id,
  });

  return (
    <StudentCompletionPage
      data={data}
      space={space}
      institutionName={auth.tenant?.name ?? "所属机构"}
    />
  );
}
