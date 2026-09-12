import {
  firstSectionParam,
  type SectionSearchParams,
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";
import GrowthToolboxListing from "@/features/growth-toolbox/components/growth-toolbox-listing";

export default async function ManagementAppToolboxRoute({
  params,
  searchParams,
}: {
  params: Promise<{ space: string; appSlug: string }>;
  searchParams: Promise<SectionSearchParams>;
}) {
  const { space, appSlug } = await params;
  const chapterId = firstSectionParam((await searchParams).chapter);
  const context = await requireManagementApplicationSection(
    space,
    appSlug,
    "toolbox",
  );

  return (
    <ManagementApplicationSectionFrame {...context} chapterId={chapterId}>
      <GrowthToolboxListing chapterId={chapterId} studentAppId={context.access.appId} />
    </ManagementApplicationSectionFrame>
  );
}
