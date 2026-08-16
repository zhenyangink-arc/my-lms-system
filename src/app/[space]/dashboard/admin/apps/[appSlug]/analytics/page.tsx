import {
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";
import { ManagementStudyAbroadInsightPage } from "@/app/dashboard/admin/apps/ManagementStudyAbroadInsightPage";

export default async function ManagementAppAnalyticsRoute({
  params,
}: {
  params: Promise<{ space: string; appSlug: string }>;
}) {
  const { space, appSlug } = await params;
  const context = await requireManagementApplicationSection(
    space,
    appSlug,
    "analytics",
  );

  return (
    <ManagementApplicationSectionFrame {...context}>
      <ManagementStudyAbroadInsightPage mode="analytics" />
    </ManagementApplicationSectionFrame>
  );
}
