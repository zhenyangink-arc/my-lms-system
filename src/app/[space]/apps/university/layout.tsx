import type { ReactNode } from "react";

import { StudentAppRouteLayout } from "@/app/dashboard/StudentAppRouteLayout";

export const dynamic = "force-dynamic";

export default async function UniversityStudentAppLayout({ children, params }: { children: ReactNode; params: Promise<{ space: string }> }) {
  const { space } = await params;
  return <StudentAppRouteLayout space={space} appSlug="university">{children}</StudentAppRouteLayout>;
}

