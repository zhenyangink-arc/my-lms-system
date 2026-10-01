import CategoryPage from "@/app/dashboard/courses/[categorySlug]/page-content";
import { getSubjectManifest } from "@/features/subjects";
import { loadUniversityCategoryScope } from "@/features/subjects/university/major-scope.server";
import { getStudentAppCoursesPath } from "@/lib/student-apps";

export default async function UniversityCategoryPage({ params, searchParams }: {
  params: Promise<{ space: string; categorySlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { space, categorySlug } = await params;
  const scope = await loadUniversityCategoryScope();
  return (
    <CategoryPage
      params={Promise.resolve({ categorySlug })}
      searchParams={searchParams}
      courseBasePath={getStudentAppCoursesPath(space, "university")}
      subcategoryLabel={getSubjectManifest("university")?.student.catalogSubcategoryLabel}
      visibleSubcategoryIds={scope.restricted ? scope.categoryIds : undefined}
    />
  );
}
