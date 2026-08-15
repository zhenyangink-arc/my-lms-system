import { StudentApplicationHome } from "@/app/dashboard/StudentApplicationHome";

export default async function MathStudentAppPage({ params }: { params: Promise<{ space: string }> }) {
  const { space } = await params;
  return <StudentApplicationHome space={space} appSlug="math" />;
}

