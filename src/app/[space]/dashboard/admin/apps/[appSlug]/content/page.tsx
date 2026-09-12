import { getDigitalTextbookManagementData } from "@/features/digital-textbook/api/service";
import { workflowChapters, workflowHref } from "@/lib/course-workflow-context";
import {
  firstSectionParam,
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
  type SectionSearchParams,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";
import CourseCatalogListing from "@/features/courses/components/course-catalog-listing";

export default async function ManagementAppContentRoute({
  params,
  searchParams,
}: {
  params: Promise<{ space: string; appSlug: string }>;
  searchParams: Promise<SectionSearchParams>;
}) {
  const { space, appSlug } = await params;
  const [context, query] = await Promise.all([
    requireManagementApplicationSection(space, appSlug, "content"),
    searchParams,
  ]);

  const chapterId = firstSectionParam(query.chapter);
  const canReadTextbooks = context.access.scope !== "platform" || context.access.globalRole === "platform_owner" || context.access.globalRole === "platform_admin";
  const textbooks = chapterId && canReadTextbooks ? await getDigitalTextbookManagementData(context.access.appId) : null;
  const chapter = textbooks && !textbooks.hasError ? workflowChapters(textbooks.courses).find(item => item.id === chapterId) : undefined;

  return (
    <ManagementApplicationSectionFrame {...context} chapterId={chapterId}>
      <CourseCatalogListing
        searchParams={Promise.resolve({
          node: firstSectionParam(query.node) ?? (chapter ? "lesson" : undefined),
          id: firstSectionParam(query.id) ?? chapter?.lessonId,
          folder: firstSectionParam(query.folder) ?? (chapter ? `lesson:${chapter.lessonId}` : undefined),
        })}
        studentAppId={context.access.appId}
        routeBasePath={workflowHref(context.access.appPath, "content", chapterId)}
        textbookRoute={workflowHref(context.access.appPath, "textbooks", chapterId)}
      />
    </ManagementApplicationSectionFrame>
  );
}
