import CourseCatalogListing from "@/features/courses/components/course-catalog-listing";

export default function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ node?: string; id?: string }>;
}) {
  return <CourseCatalogListing searchParams={searchParams} />;
}
