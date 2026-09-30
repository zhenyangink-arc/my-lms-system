import { AssignmentDetailPageContent } from "@/app/dashboard/assignments/[assignmentId]/page-content";

export default function EnglishAssignmentDetailPage({
  params,
}: {
  params: Promise<{ space: string; assignmentId: string }>;
}) {
  return <AssignmentDetailPageContent params={params} studentAppSlug="english" />;
}
