import { PracticeMemoryRedirect } from "@/app/dashboard/practice/PracticeMemoryRedirect";
import { requireActiveUser } from "@/lib/auth";
import { getStudentAppBasePath } from "@/lib/student-apps";

export default async function KoreanPracticePage({
  params,
}: {
  params: Promise<{ space: string }>;
}) {
  const { space } = await params;
  const { user } = await requireActiveUser();

  return (
    <PracticeMemoryRedirect
      studentId={user.id}
      studentAppBasePath={getStudentAppBasePath(space, "korean")}
    />
  );
}
