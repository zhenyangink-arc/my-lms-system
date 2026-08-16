import { ManagementApplicationSettingsPage } from "@/app/dashboard/admin/apps/ManagementApplicationSettingsPage";
import {
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";

export default async function ManagementAppSettingsRoute({
  params,
}: {
  params: Promise<{ space: string; appSlug: string }>;
}) {
  const { space, appSlug } = await params;
  const context = await requireManagementApplicationSection(
    space,
    appSlug,
    "settings",
  );

  return (
    <ManagementApplicationSectionFrame {...context}>
      <ManagementApplicationSettingsPage access={context.access} />
    </ManagementApplicationSectionFrame>
  );
}
