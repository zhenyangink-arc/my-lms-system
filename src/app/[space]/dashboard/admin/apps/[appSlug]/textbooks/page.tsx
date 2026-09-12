import DigitalTextbookAdminPage from "@/app/dashboard/admin/digital-textbook/page-content";
import {
  firstSectionParam,
  type SectionSearchParams,
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";

export default async function ManagementAppTextbooksRoute({
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
    "textbooks",
  );

  return (
    <ManagementApplicationSectionFrame {...context} chapterId={chapterId}>
      <DigitalTextbookAdminPage
        chapterId={chapterId} studentAppId={context.access.appId}
        courseStructureRoute={`${context.access.appPath}/content`}
      />
    </ManagementApplicationSectionFrame>
  );
}
