import { StudentApplicationHome } from "@/app/dashboard/StudentApplicationHome";

export default async function StudyAbroadStudentAppPage({ params }: { params: Promise<{ space: string }> }) {
  const { space } = await params;
  return <StudentApplicationHome space={space} appSlug="study-abroad" />;
}

