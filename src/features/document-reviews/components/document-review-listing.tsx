import { getDocumentReviewManagementData } from "../api/service";
import { DocumentReviewApplicationsTable } from "./document-review-applications-table";
import { PlatformDocumentReviewOverview } from "./platform-document-review-overview";

const ROLE_LABELS: Record<string, string> = {
  tenant_super_admin: "机构负责人",
  ceo: "机构运营负责人",
  admin: "授权管理员",
};

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
      <section className="management-table-panel overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="management-summary-table w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr>
                <th>管理范围</th>
                <th>申请单</th>
                <th>待确认</th>
                <th>需补充</th>
                <th>已确认</th>
                <th>已锁定</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>{ROLE_LABELS[result.role] ?? "本机构资料审核"}</th>
                <td>{result.applications.length}</td>
                <td>{pendingCount}</td>
                <td>{revisionCount}</td>
                <td>{approvedCount}</td>
                <td>{lockedCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <DocumentReviewApplicationsTable
        data={result.applications}
        dashboardBasePath={result.dashboardBasePath}
      />
    </div>
  );
}
