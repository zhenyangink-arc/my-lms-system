import { StudentSubjectHome } from "@/app/dashboard/StudentSubjectHome";

export default async function EnglishStudentAppPage({ params }: { params: Promise<{ space: string }> }) {
  const { space } = await params;
  return <StudentSubjectHome space={space} appSlug="english" />;
}
