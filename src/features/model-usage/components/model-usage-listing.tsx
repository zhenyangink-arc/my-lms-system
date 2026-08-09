import { getModelUsageData } from "../api/service";
import { ModelUsageTable } from "./model-usage-table";

export default async function ModelUsageListing() {
  const result = await getModelUsageData();
  const rows = [...result.platformRows, ...result.organizationRows];

  return (
    <div className="space-y-4">
      {result.hasQueryError && (
        <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          暂时无法读取完整的模型用量或机构数据，请稍后刷新重试。
        </p>
      )}
      <ModelUsageTable
        data={rows}
        canViewAllTenants={result.canViewAllTenants}
        queryLimit={result.queryLimit}
      />
    </div>
  );
}
