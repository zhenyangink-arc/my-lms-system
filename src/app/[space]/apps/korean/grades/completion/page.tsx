import { redirect } from "next/navigation";

import { StudentCompletionPage } from "@/features/course-completion/StudentCompletionPage";
import { getStudentCompletionData } from "@/features/course-completion/student-service";
import { requireActiveUser } from "@/lib/auth";
import { getGradeCenterAccess } from "@/lib/grade-center";
import { STUDENT_APP_IDS } from "@/lib/student-apps";
import { getViewerTimeZone } from "@/lib/viewer-time-zone.server";

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
    appId: STUDENT_APP_IDS.korean,
    fallbackCourseTitle: "韩语一级课程",
  });

  return (
    <StudentCompletionPage
      data={data}
      space={space}
      studentAppSlug="korean"
      institutionName={auth.tenant?.name ?? "所属机构"}
      timeZone={await getViewerTimeZone()}
    />
  );
}
