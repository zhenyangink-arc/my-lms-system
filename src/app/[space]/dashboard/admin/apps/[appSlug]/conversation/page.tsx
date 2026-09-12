import { ConversationPracticeManagementContent } from "@/app/dashboard/admin/conversation-practice/page-content";
import { PlatformInsightPage } from "@/features/platform-learning-insights/PlatformInsightPage";
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
        <PlatformInsightPage
          appSlug={appSlug}
          searchParams={query}
          mode="conversation"
        />
      ) : (
        <ConversationPracticeManagementContent
          searchParams={Promise.resolve({
            scenario: firstSectionParam(query.scenario),
            mode: firstSectionParam(query.mode),
            progressSort: firstSectionParam(query.progressSort),
            progressDirection: firstSectionParam(query.progressDirection),
          })}
          studentAppId={context.access.appId}
          routeBasePath={`${context.access.appPath}/conversation`}
          embedded
        />
      )}
    </ManagementApplicationSectionFrame>
  );
}
