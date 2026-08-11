import PageContainer from "@/components/layout/page-container";
import StudentAssignmentListing from "@/features/student-assignments/components/student-assignment-listing";

export type { AssignmentMember } from "@/features/student-assignments/api/types";

export const dynamic = "force-dynamic";

export default function StudentAssignmentsPage() {
  return (
    <PageContainer contentClassName="mx-auto w-full max-w-[1400px]">
      <StudentAssignmentListing />
    </PageContainer>
  );
}
