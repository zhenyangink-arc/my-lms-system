import TeachingScriptStudioPage from "@/app/dashboard/admin/teaching-scripts/page-content";
import {
  firstSectionParam,
  type SectionSearchParams,
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";

export default async function ManagementAppTeachingScriptsRoute({
  params,
  searchParams,
}: {
  params: Promise<{ space: string; appSlug: string }>;
  searchParams: Promise<SectionSearchParams>;
}) {
  const { space, appSlug } = await params;
  const chapterId = firstSectionParam((await searchParams).chapter);
  const context = await requireManagementApplicationSection(space, appSlug, "teaching-scripts");

  return (
    <ManagementApplicationSectionFrame {...context} chapterId={chapterId} className="management-teaching-script-page">
      <TeachingScriptStudioPage chapterId={chapterId} studentAppId={context.access.appId} />
    </ManagementApplicationSectionFrame>
  );
}
