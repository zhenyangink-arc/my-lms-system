import DigitalTextbookAdminPage from "@/app/dashboard/admin/digital-textbook/page-content";
import {
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";

export default async function ManagementAppTextbooksRoute({
  params,
}: {
  params: Promise<{ space: string; appSlug: string }>;
}) {
  const { space, appSlug } = await params;
  const context = await requireManagementApplicationSection(
    space,
    appSlug,
    "textbooks",
  );

  return (
    <ManagementApplicationSectionFrame {...context}>
      <DigitalTextbookAdminPage
        studentAppId={context.access.appId}
        courseStructureRoute={`${context.access.appPath}/content`}
      />
    </ManagementApplicationSectionFrame>
  );
}
