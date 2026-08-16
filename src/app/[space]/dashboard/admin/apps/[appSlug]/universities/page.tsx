import {
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";
import UniversityListing from "@/features/universities/components/university-listing";

export default async function ManagementAppUniversitiesRoute({
  params,
}: {
  params: Promise<{ space: string; appSlug: string }>;
}) {
  const { space, appSlug } = await params;
  const context = await requireManagementApplicationSection(
    space,
    appSlug,
    "universities",
  );

  return (
    <ManagementApplicationSectionFrame {...context}>
      <UniversityListing />
    </ManagementApplicationSectionFrame>
  );
}
