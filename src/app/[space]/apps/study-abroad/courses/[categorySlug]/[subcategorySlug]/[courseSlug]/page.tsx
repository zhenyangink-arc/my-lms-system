import CoursePage from "@/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/page-content";
import { getStudentAppCoursesPath } from "@/lib/student-apps";

export default async function StudyAbroadCoursePage({ params }: {
  params: Promise<{ space: string; categorySlug: string; subcategorySlug: string; courseSlug: string }>;
}) {
  const { space, categorySlug, subcategorySlug, courseSlug } = await params;
  return <CoursePage params={Promise.resolve({ categorySlug, subcategorySlug, courseSlug })} courseBasePath={getStudentAppCoursesPath(space, "study-abroad")} />;
}
