import { redirect } from "next/navigation";

import { requireActiveUser } from "@/lib/auth";
import { loadStudentReviewCenter } from "@/features/student-review-center/service";
import { loadCoursePracticeCatalog } from "@/lib/course-practice-catalog.server";
import { getStudentAppBasePath, getStudentAppPath, STUDENT_APP_IDS } from "@/lib/student-apps";
import { CoursePracticeDirectory } from "./course-practice-directory";

export default async function KoreanCoursePracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ space: string }>;
  searchParams: Promise<{
    area?: string;
    course?: string;
    chapter?: string;
  }>;
}) {
  const [{ space }, query] = await Promise.all([params, searchParams]);
  const coursePracticePath = getStudentAppPath(
    space,
    "korean",
    "practice/course",
  );

  if (query.course && query.chapter) {
    redirect(
      `${coursePracticePath}/${encodeURIComponent(query.course)}/${encodeURIComponent(query.chapter)}`,
    );
  }

  const { supabase, user } = await requireActiveUser();
  const [courses, reviewResult] = await Promise.all([
    loadCoursePracticeCatalog({ supabase, userId: user.id }),
    loadStudentReviewCenter({
      supabase,
      studentId: user.id,
      studentAppId: STUDENT_APP_IDS.korean,
    }),
  ]);

  return (
    <CoursePracticeDirectory
      courses={courses}
      baseHref={coursePracticePath}
      appHref={getStudentAppBasePath(space, "korean")}
      reviewHref={getStudentAppPath(space, "korean", "practice/review")}
      skillsHref={getStudentAppPath(space, "korean", "practice/skills")}
      reviewItems={reviewResult.items}
    />
  );
}
