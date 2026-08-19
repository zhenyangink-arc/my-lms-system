import { requireActiveUser } from "@/lib/auth";
import { getStudentAppPath, STUDENT_APP_IDS } from "@/lib/student-apps";
import { loadStudentReviewCenter } from "@/features/student-review-center/service";
import { StudentReviewCenter } from "@/features/student-review-center/student-review-center";

export default async function KoreanReviewPracticePage({
  params,
}: {
  params: Promise<{ space: string }>;
}) {
  const { space } = await params;
  const { supabase, user, profile } = await requireActiveUser();
  const routes = {
    coursePracticeBaseHref: getStudentAppPath(space, "korean", "practice/course"),
    skillsBaseHref: getStudentAppPath(space, "korean", "practice/skills"),
    trainingBaseHref: getStudentAppPath(space, "korean", "training"),
    assignmentsBaseHref: getStudentAppPath(space, "korean", "assignments"),
  };
  if (profile?.role !== "student") {
    return <StudentReviewCenter items={[]} error="只有学生账号可以查看自己的错题复习记录。" {...routes} />;
  }
  const result = await loadStudentReviewCenter({
    supabase,
    studentId: user.id,
    studentAppId: STUDENT_APP_IDS.korean,
  });
  return <StudentReviewCenter items={result.items} error={result.error} {...routes} />;
}
