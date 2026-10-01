import { CourseCatalog } from "@/app/dashboard/courses/page-content";

export default async function UniversityCoursesPage({
  params,
}: {
  params: Promise<{ space: string }>;
}) {
  const { space } = await params;
  return <CourseCatalog studentAppSlug="university" space={space} />;
}
