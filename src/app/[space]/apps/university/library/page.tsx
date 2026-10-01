import { LibraryPageContent } from "@/app/dashboard/library/page-content";
import { loadUniversityCategoryScope } from "@/features/subjects/university/major-scope.server";

export default async function UniversityLibraryPage() {
  const scope = await loadUniversityCategoryScope();
  return (
    <LibraryPageContent
      studentAppSlug="university"
      visibleCategoryIds={scope.restricted ? scope.categoryIds : undefined}
    />
  );
}
