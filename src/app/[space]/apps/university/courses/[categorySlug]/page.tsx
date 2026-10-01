import CategoryPage from "@/app/dashboard/courses/[categorySlug]/page-content";
import { getSubjectManifest } from "@/features/subjects";
import { loadUniversityCategoryScope } from "@/features/subjects/university/major-scope.server";
import { NoMajorNotice } from "@/features/subjects/university/student/NoMajorNotice";
import { getStudentAppCoursesPath } from "@/lib/student-apps";

export default async function UniversityCategoryPage({ params, searchParams }: {
  params: Promise<{ space: string; categorySlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { space, categorySlug } = await params;
  const scope = await loadUniversityCategoryScope();
  return (
    <>
      {scope.restricted && !scope.hasActiveMajor ? (
        <div className="mx-auto w-full max-w-[1500px] px-4 pt-6 sm:px-6 lg:px-8"><NoMajorNotice /></div>
      ) : null}
      <CategoryPage
        params={Promise.resolve({ categorySlug })}
        searchParams={searchParams}
        courseBasePath={getStudentAppCoursesPath(space, "university")}
        subcategoryLabel={getSubjectManifest("university")?.student.catalogSubcategoryLabel}
        visibleSubcategoryIds={scope.restricted ? scope.categoryIds : undefined}
      />
    </>
  );
}
