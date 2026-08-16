import { ManagementPlatformApplicationOverviewPage } from "@/app/dashboard/admin/apps/ManagementPlatformApplicationOverviewPage";
import {
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";
import { GradeListingContent } from "@/features/grades/components/grade-listing";

export default async function ManagementAppGradesRoute({
  params,
}: {
  params: Promise<{ space: string; appSlug: string }>;
}) {
  const { space, appSlug } = await params;
  const context = await requireManagementApplicationSection(
    space,
    appSlug,
    "grades",
  );

  return (
    <ManagementApplicationSectionFrame {...context}>
      {context.access.scope === "platform" ? (
        <ManagementPlatformApplicationOverviewPage
          access={context.access}
          mode="grades"
        />
      ) : (
        <GradeListingContent
          studentAppId={context.access.appId}
          assignmentDetailBasePath={`${context.access.appPath}/assignments`}
        />
      )}
    </ManagementApplicationSectionFrame>
  );
}
