import { CourseCatalog } from "@/app/dashboard/courses/page-content";

export default async function StudyAbroadCoursesPage({ params }: { params: Promise<{ space: string }> }) {
  const { space } = await params;
  return <CourseCatalog studentAppSlug="study-abroad" space={space} />;
}
