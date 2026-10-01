import LessonPage from "@/app/dashboard/courses/[categorySlug]/[subcategorySlug]/[courseSlug]/[lessonSlug]/page-content";
import { getStudentAppCoursesPath } from "@/lib/student-apps";

// 复用平台课时页（不修改它）。大学课程暂无完整课程访问开关，学生目前只能进入免费试看课时。
export default async function UniversityLessonPage({ params, searchParams }: {
  params: Promise<{ space: string; categorySlug: string; subcategorySlug: string; courseSlug: string; lessonSlug: string }>;
  searchParams: Promise<{ chapter?: string | string[] }>;
}) {
  const { space, categorySlug, subcategorySlug, courseSlug, lessonSlug } = await params;
  return <LessonPage params={Promise.resolve({ categorySlug, subcategorySlug, courseSlug, lessonSlug })} searchParams={searchParams} courseBasePath={getStudentAppCoursesPath(space, "university")} />;
}
