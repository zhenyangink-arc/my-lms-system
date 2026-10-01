import { CourseCatalog } from "@/app/dashboard/courses/page-content";
import { loadUniversityCategoryScope } from "@/features/subjects/university/major-scope.server";
import { NoMajorNotice } from "@/features/subjects/university/student/NoMajorNotice";

export default async function UniversityCoursesPage({
  params,
}: {
  params: Promise<{ space: string }>;
}) {
  const { space } = await params;
  const scope = await loadUniversityCategoryScope();
  return (
    <>
      {scope.restricted && !scope.hasActiveMajor ? (
        <div className="mx-auto w-full max-w-[1500px] px-4 pt-6 sm:px-6 lg:px-8"><NoMajorNotice /></div>
      ) : null}
      <CourseCatalog
        studentAppSlug="university"
        space={space}
        visibleSubcategoryIds={scope.restricted ? scope.categoryIds : undefined}
      />
    </>
  );
}
