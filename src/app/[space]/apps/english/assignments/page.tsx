import { AssignmentsPageContent } from "@/app/dashboard/assignments/page-content";

export default function EnglishAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AssignmentsPageContent searchParams={searchParams} studentAppSlug="english" />
  );
}
