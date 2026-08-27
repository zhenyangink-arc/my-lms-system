import CategoryPage from "@/app/dashboard/courses/[categorySlug]/page-content";
import { getStudentAppCoursesPath } from "@/lib/student-apps";

export default async function StudyAbroadCategoryPage({ params, searchParams }: {
  params: Promise<{ space: string; categorySlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { space, categorySlug } = await params;
  return <CategoryPage params={Promise.resolve({ categorySlug })} searchParams={searchParams} courseBasePath={getStudentAppCoursesPath(space, "study-abroad")} />;
}
