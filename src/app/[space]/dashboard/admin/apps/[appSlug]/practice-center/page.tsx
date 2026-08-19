import { notFound } from "next/navigation";

import {
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";
import ChapterPracticeCoverageListing from "@/features/chapter-practice/components/chapter-practice-coverage-listing";
import { requirePlatformOwner } from "@/lib/admin";

export default async function ChapterPracticeCenterManagementRoute({
  params,
}: {
  params: Promise<{ space: string; appSlug: string }>;
}) {
  const { space, appSlug } = await params;
  const [context] = await Promise.all([
    requireManagementApplicationSection(space, appSlug, "practice-center"),
    requirePlatformOwner(),
  ]);

  if (context.access.scope !== "platform" || appSlug !== "korean") {
    notFound();
  }

  return (
    <ManagementApplicationSectionFrame {...context}>
      <ChapterPracticeCoverageListing space={space} />
    </ManagementApplicationSectionFrame>
  );
}
