import { AssignmentDetailPageContent } from "@/app/dashboard/assignments/[assignmentId]/page-content";

export default function UniversityAssignmentDetailPage({
  params,
}: {
  params: Promise<{ space: string; assignmentId: string }>;
}) {
  return <AssignmentDetailPageContent params={params} studentAppSlug="university" />;
}
