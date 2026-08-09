import { getUniversityManagementData } from "../api/service";
import { UniversitiesTable } from "./universities-table";

export default async function UniversityListing() {
  const result = await getUniversityManagementData();
  const publishedCount = result.universities.filter(
    (university) => university.is_published,
  ).length;
  const featuredCount = result.universities.filter(
    (university) => university.is_featured,
  ).length;
  const regionCount = new Set(
    result.universities.map((university) => university.province),
  ).size;

  return (
    <div className="space-y-4">
      {result.hasError && (
        <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          大学资料暂时无法完整读取，请稍后刷新重试。
        </p>
      )}
      {result.isInstitutionViewer && (
        <p className="border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-800">
          当前账号为只读查看范围，不能修改大学资料或发布状态。
        </p>
      )}

      <section className="management-table-panel overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="management-summary-table w-full min-w-[680px] border-collapse text-left">
            <thead>
              <tr>
                <th>资料范围</th>
                <th>大学总数</th>
                <th>已发布</th>
                <th>未发布</th>
                <th>重点推荐</th>
                <th>覆盖地区</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>{result.canManageContent ? "平台大学资料" : "可查看大学资料"}</th>
                <td>{result.universities.length}</td>
                <td>{publishedCount}</td>
                <td>{result.universities.length - publishedCount}</td>
                <td>{featuredCount}</td>
                <td>{regionCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <UniversitiesTable data={result.universities} />
    </div>
  );
}
