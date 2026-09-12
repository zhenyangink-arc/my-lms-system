import { CompletionPolicyWorkspace } from "@/features/course-completion/CompletionPolicyWorkspace";
import { redirect } from "next/navigation";

import {
  ManagementApplicationSectionFrame,
  requireManagementApplicationSection,
} from "@/app/dashboard/admin/apps/ManagementApplicationSectionPage";
import { CompletionReviewWorkspace } from "@/features/course-completion/CompletionReviewWorkspace";
import { CompletionStatisticsPanel } from "@/features/course-completion/CompletionStatisticsPanel";
import { getCompletionReviewData } from "@/features/course-completion/review-service";
import { getCompletionStatistics } from "@/features/course-completion/statistics-service";

export const dynamic = "force-dynamic";

export default async function CompletionReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ space: string; appSlug: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { space, appSlug } = await params;
  const feedback = await searchParams;
  const context = await requireManagementApplicationSection(
    space,
    appSlug,
    "completion-review",
  );
  const canReviewInstitution =
    context.access.scope === "tenant" &&
    context.access.app.slug === "korean" &&
    ["teacher", "tenant_super_admin", "ceo"].includes(context.access.role);
  const canViewPlatformStatistics =
    context.access.scope === "platform" &&
    context.access.app.slug === "korean" &&
    context.access.globalRole === "platform_owner";

  if (!canReviewInstitution && !canViewPlatformStatistics) {
    redirect(context.access.appPath);
  }

  const isInstitutionLeader =
    canReviewInstitution && context.access.role !== "teacher";
  const [statistics, data] = await Promise.all([
    isInstitutionLeader || canViewPlatformStatistics
      ? getCompletionStatistics(context.access)
      : Promise.resolve(null),
    canReviewInstitution
      ? getCompletionReviewData(context.access)
      : Promise.resolve(null),
  ]);

  return (
    <ManagementApplicationSectionFrame {...context}>
      <div className="space-y-5">
        {(feedback.error || feedback.success) && <p className="rounded-lg border p-3 text-sm" role={feedback.error ? "alert" : "status"}>{feedback.error || feedback.success}</p>}
        {(canViewPlatformStatistics || isInstitutionLeader) && <CompletionPolicyWorkspace space={space} appSlug={appSlug} appId={context.access.appId} platform={canViewPlatformStatistics} />}
        {statistics ? <CompletionStatisticsPanel statistics={statistics} /> : null}
        {data ? (
          <CompletionReviewWorkspace
            data={data}
            space={space}
            appSlug={appSlug}
            canManageCertificates={context.access.role !== "teacher"}
          />
        ) : null}
      </div>
    </ManagementApplicationSectionFrame>
  );
}
