import VisaManagementStudentViewPage from "@/features/visa-management/components/visa-management-student-view-page";

export default async function StudentVisaManagementPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  return <VisaManagementStudentViewPage studentId={studentId} />;
}
