import { CourseCatalog } from "@/app/dashboard/courses/page-content";

export default async function KoreanCoursesPage({
  params,
}: {
  params: Promise<{ space: string }>;
}) {
  const { space } = await params;
  return <CourseCatalog studentAppSlug="korean" space={space} />;
}
