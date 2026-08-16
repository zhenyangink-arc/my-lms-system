import { ManagementApplicationPeoplePage } from "@/app/dashboard/admin/apps/ManagementApplicationPeoplePage";
import {
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";

export default async function ManagementAppStudentsRoute({
  params,
}: {
  params: Promise<{ space: string; appSlug: string }>;
}) {
  const { space, appSlug } = await params;
  const context = await requireManagementApplicationSection(
    space,
    appSlug,
    "students",
  );

  return (
    <ManagementApplicationSectionFrame {...context}>
      <ManagementApplicationPeoplePage access={context.access} />
    </ManagementApplicationSectionFrame>
  );
}
