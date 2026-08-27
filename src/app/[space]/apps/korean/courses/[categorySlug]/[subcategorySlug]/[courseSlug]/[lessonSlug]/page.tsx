import LessonPage from "@/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page-content";
import { getStudentAppCoursesPath } from "@/lib/student-apps";

export default async function KoreanLessonPage({ params, searchParams }: {
  params: Promise<{ space: string; categorySlug: string; subcategorySlug: string; courseSlug: string; lessonSlug: string }>;
  searchParams: Promise<{ chapter?: string | string[] }>;
}) {
  const { space, categorySlug, subcategorySlug, courseSlug, lessonSlug } = await params;
  return <LessonPage params={Promise.resolve({ categorySlug, subcategorySlug, courseSlug, lessonSlug })} searchParams={searchParams} courseBasePath={getStudentAppCoursesPath(space, "korean")} />;
}
