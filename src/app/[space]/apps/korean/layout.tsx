import type { ReactNode } from "react";

import { StudentAppRouteLayout } from "@/app/dashboard/StudentAppRouteLayout";

export const dynamic = "force-dynamic";

export default async function KoreanStudentAppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ space: string }>;
}) {
  const { space } = await params;
  return (
    <StudentAppRouteLayout space={space} appSlug="korean">
      {children}
    </StudentAppRouteLayout>
  );
}

