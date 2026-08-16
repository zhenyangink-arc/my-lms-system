import { getGradeManagementData } from "../api/service";
import { GradeResultsTable } from "./grade-results-table";
import { GradeReviewRequestsTable } from "./grade-review-requests-table";
import { PlatformGradeOverview } from "./platform-grade-overview";

const ROLE_SCOPE_LABELS: Record<string, string> = {
  teacher: "当前教师负责的学生",
  tenant_super_admin: "当前机构全部学生",
  ceo: "当前机构全部学生",
  admin: "当前机构全部学生",
};

export async function GradeListingContent({
  studentAppId,
  assignmentDetailBasePath,
}: {
  studentAppId?: string;
  assignmentDetailBasePath?: string;
}) {
  const result = await getGradeManagementData(
    studentAppId,
    assignmentDetailBasePath,
  );

  if (result.scope === "platform") {
    return (
      <PlatformGradeOverview
        rows={result.overview}
        hasError={result.hasError}
      />
    );
  }

  const scopeLabel = ROLE_SCOPE_LABELS[result.role] ?? "当前机构学生";
  const assignmentCount = result.results.filter(
    (row) => row.source_type === "assignment_submission",
  ).length;
  const chapterTestCount = result.results.length - assignmentCount;

  return (
    <div className="space-y-4">
      {result.hasError && (
        <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          部分实时成绩数据暂时无法读取，请稍后刷新。
        </p>
      )}

      <section className="management-table-panel overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="management-summary-table w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr>
                <th>统计范围</th>
                <th>成绩来源</th>
                <th>作业成绩</th>
                <th>章节测试成绩</th>
                <th>复核处理中</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>{scopeLabel}</th>
                <td>{result.sources.length}</td>
                <td>{assignmentCount}</td>
                <td>{chapterTestCount}</td>
                <td>{result.pendingReviewCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <GradeResultsTable
        data={result.results}
        scopeLabel={scopeLabel}
        canManageGrades={result.canManageIndividualGrades}
      />
      <GradeReviewRequestsTable
        data={result.reviews}
        scopeLabel={scopeLabel}
        canResolveReviews={result.canManageIndividualGrades}
        studentAppId={studentAppId}
      />
    </div>
  );
}

export default function GradeListing() {
  return <GradeListingContent />;
}
