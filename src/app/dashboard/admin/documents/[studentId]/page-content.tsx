import DocumentReviewStudentView from "@/features/document-reviews/components/document-review-student-view";

export default async function StudentDocumentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  return <DocumentReviewStudentView studentId={studentId} />;
}
