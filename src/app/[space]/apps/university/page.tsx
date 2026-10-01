import { StudentSubjectHome } from "@/app/dashboard/StudentSubjectHome";

export default async function UniversityStudentAppPage({ params }: { params: Promise<{ space: string }> }) {
  const { space } = await params;
  return <StudentSubjectHome space={space} appSlug="university" />;
}
