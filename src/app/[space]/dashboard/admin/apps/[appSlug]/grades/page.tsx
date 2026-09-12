import { PlatformInsightPage } from "@/features/platform-learning-insights/PlatformInsightPage";
import {
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";
import { GradeListingContent } from "@/features/grades/components/grade-listing";

export default async function ManagementAppGradesRoute({
  params,
  searchParams,
}: {
  params: Promise<{ space: string; appSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
        <PlatformInsightPage
          appSlug={appSlug}
          searchParams={await searchParams}
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
