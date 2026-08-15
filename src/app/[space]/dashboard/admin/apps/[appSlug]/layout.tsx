import type { ReactNode } from "react";

import { requireManagementAppAccess } from "@/lib/management-apps";

export default async function ManagementAppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ space: string; appSlug: string }>;
}) {
  const { space, appSlug } = await params;
  await requireManagementAppAccess(space, appSlug);
  return children;
}
