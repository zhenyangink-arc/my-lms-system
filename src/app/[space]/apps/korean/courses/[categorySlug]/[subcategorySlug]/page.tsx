import SubcategoryPage from "@/app/dashboard/courses/[categorySlug]/[subcategorySlug]/page-content";
import { getStudentAppCoursesPath } from "@/lib/student-apps";

export default async function KoreanSubcategoryPage({ params }: {
  params: Promise<{ space: string; categorySlug: string; subcategorySlug: string }>;
}) {
  const { space, categorySlug, subcategorySlug } = await params;
  return <SubcategoryPage params={Promise.resolve({ categorySlug, subcategorySlug })} courseBasePath={getStudentAppCoursesPath(space, "korean")} />;
}
