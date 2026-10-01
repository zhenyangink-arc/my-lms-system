import { CourseCatalog } from "@/app/dashboard/courses/page-content";
import { loadUniversityCategoryScope } from "@/features/subjects/university/major-scope.server";

export default async function UniversityCoursesPage({
  params,
}: {
  params: Promise<{ space: string }>;
}) {
  const { space } = await params;
  const scope = await loadUniversityCategoryScope();
  return (
    <CourseCatalog
      studentAppSlug="university"
      space={space}
      visibleSubcategoryIds={scope.restricted ? scope.categoryIds : undefined}
    />
  );
}
