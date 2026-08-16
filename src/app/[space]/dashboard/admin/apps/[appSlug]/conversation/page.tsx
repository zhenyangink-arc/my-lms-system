import { ConversationPracticeManagementContent } from "@/app/dashboard/admin/conversation-practice/page-content";
import { ManagementPlatformApplicationOverviewPage } from "@/app/dashboard/admin/apps/ManagementPlatformApplicationOverviewPage";
import {
  firstSectionParam,
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
  type SectionSearchParams,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";

export default async function ManagementAppConversationRoute({
  params,
  searchParams,
}: {
  params: Promise<{ space: string; appSlug: string }>;
  searchParams: Promise<SectionSearchParams>;
}) {
  const { space, appSlug } = await params;
  const [context, query] = await Promise.all([
    requireManagementApplicationSection(space, appSlug, "conversation"),
    searchParams,
  ]);

  return (
    <ManagementApplicationSectionFrame {...context}>
      {context.access.scope === "platform" ? (
        <ManagementPlatformApplicationOverviewPage
          access={context.access}
          mode="conversation"
        />
      ) : (
        <ConversationPracticeManagementContent
          searchParams={Promise.resolve({
            scenario: firstSectionParam(query.scenario),
            mode: firstSectionParam(query.mode),
          })}
          studentAppId={context.access.appId}
          routeBasePath={`${context.access.appPath}/conversation`}
          embedded
        />
      )}
    </ManagementApplicationSectionFrame>
  );
}
