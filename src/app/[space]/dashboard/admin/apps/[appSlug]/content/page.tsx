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

  return (
    <ManagementApplicationSectionFrame {...context}>
      <CourseCatalogListing
        searchParams={Promise.resolve({
          node: firstSectionParam(query.node),
          id: firstSectionParam(query.id),
        })}
        studentAppId={context.access.appId}
        routeBasePath={`${context.access.appPath}/content`}
        textbookRoute={`${context.access.appPath}/textbooks`}
      />
    </ManagementApplicationSectionFrame>
  );
}
