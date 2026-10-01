import type { ReactNode } from "react";

import { StudentAssignmentDetailLayout } from "@/app/dashboard/assignments/StudentAssignmentDetailLayout";

export default async function MathAssignmentDetailLayout({ children, params }: { children: ReactNode; params: Promise<{ space: string; assignmentId: string }> }) {
  const { space, assignmentId } = await params;
  return (
    <StudentAssignmentDetailLayout space={space} assignmentId={assignmentId} appSlug="math">
      {children}
    </StudentAssignmentDetailLayout>
  );
}
