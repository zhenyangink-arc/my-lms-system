import { PlatformSettingsPage } from "@/features/platform-learning-insights/PlatformSettingsPage";
import { ManagementApplicationSettingsPage } from "@/app/dashboard/admin/apps/ManagementApplicationSettingsPage";
import {
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";

export default async function ManagementAppSettingsRoute({
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
    "settings",
  );

  return (
    <ManagementApplicationSectionFrame {...context}>
      {context.access.scope === "platform" ? <PlatformSettingsPage appSlug={appSlug} searchParams={await searchParams} /> : <ManagementApplicationSettingsPage access={context.access} />}
    </ManagementApplicationSectionFrame>
  );
}
