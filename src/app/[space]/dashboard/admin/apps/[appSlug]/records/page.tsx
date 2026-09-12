import { PlatformInsightPage } from "@/features/platform-learning-insights/PlatformInsightPage";
import {
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";
import { ManagementStudyAbroadInsightPage } from "@/app/dashboard/admin/apps/ManagementStudyAbroadInsightPage";
import { LearningRecordListingContent } from "@/features/learning-records/components/learning-record-listing";

export default async function ManagementAppRecordsRoute({
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
    "records",
  );
  let content: React.ReactNode;

  if (context.access.app.kind === "service") {
    content = <ManagementStudyAbroadInsightPage mode="records" />;
  } else if (context.access.scope === "platform") {
    content = (
      <PlatformInsightPage
        appSlug={appSlug}
        searchParams={await searchParams}
        mode="records"
      />
    );
  } else {
    content = (
      <LearningRecordListingContent studentAppId={context.access.appId} />
    );
  }

  return (
    <ManagementApplicationSectionFrame {...context}>
      {content}
    </ManagementApplicationSectionFrame>
  );
}
