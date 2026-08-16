import {
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";
import GrowthToolboxListing from "@/features/growth-toolbox/components/growth-toolbox-listing";

export default async function ManagementAppToolboxRoute({
  params,
}: {
  params: Promise<{ space: string; appSlug: string }>;
}) {
  const { space, appSlug } = await params;
  const context = await requireManagementApplicationSection(
    space,
    appSlug,
    "toolbox",
  );

  return (
    <ManagementApplicationSectionFrame {...context}>
      <GrowthToolboxListing studentAppId={context.access.appId} />
    </ManagementApplicationSectionFrame>
  );
}
