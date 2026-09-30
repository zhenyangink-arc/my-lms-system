import { CourseCatalog } from "@/app/dashboard/courses/page-content";

export default async function EnglishCoursesPage({
  params,
}: {
  params: Promise<{ space: string }>;
}) {
  const { space } = await params;
  return <CourseCatalog studentAppSlug="english" space={space} />;
}
