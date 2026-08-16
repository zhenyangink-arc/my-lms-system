import { ManagementMetricStrip } from "@/components/layout/management-page";
import { getDocumentReviewManagementData } from "../api/service";
import { DocumentReviewApplicationsTable } from "./document-review-applications-table";
import { PlatformDocumentReviewOverview } from "./platform-document-review-overview";

export default async function DocumentReviewListing() {
  const result = await getDocumentReviewManagementData();

  if (result.scope === "platform") {
    return (
      <PlatformDocumentReviewOverview
        rows={result.overview}
        hasError={result.hasError}
      />
    );
  }

  const pendingCount = result.applications.filter(
    (application) => application.reviewStatus === "pending_review",
  ).length;
  const revisionCount = result.applications.filter(
    (application) => application.reviewStatus === "revision_required",
  ).length;
  const approvedCount = result.applications.filter(
    (application) => application.reviewStatus === "approved",
  ).length;
  const lockedCount = result.applications.filter(
    (application) => application.documentsLockedAt !== null,
  ).length;

  return (
    <div className="space-y-4">
      <ManagementMetricStrip
        label="申请材料审核概况"
        items={[
          { label: "申请单", value: result.applications.length },
          { label: "待确认", value: pendingCount },
          { label: "需补充", value: revisionCount },
          { label: "已确认", value: approvedCount },
          { label: "已锁定", value: lockedCount },
        ]}
      />

      <DocumentReviewApplicationsTable
        data={result.applications}
        dashboardBasePath={result.dashboardBasePath}
      />
    </div>
  );
}
