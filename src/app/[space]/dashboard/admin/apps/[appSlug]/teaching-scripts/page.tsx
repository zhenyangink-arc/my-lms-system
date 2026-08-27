import TeachingScriptStudioPage from "@/app/dashboard/admin/teaching-scripts/page-content";
import {
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";

export default async function ManagementAppTeachingScriptsRoute({
  params,
}: {
  params: Promise<{ space: string; appSlug: string }>;
}) {
  const { space, appSlug } = await params;
  const context = await requireManagementApplicationSection(space, appSlug, "teaching-scripts");

  return (
    <ManagementApplicationSectionFrame {...context}>
      <TeachingScriptStudioPage studentAppId={context.access.appId} />
    </ManagementApplicationSectionFrame>
  );
}
