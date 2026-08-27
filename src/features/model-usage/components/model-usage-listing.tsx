import { Activity } from "lucide-react";

import {
  ManagementNotice,
  ManagementPage,
} from "@/components/layout/management-page";
import { getModelUsageData } from "../api/service";
import { ModelUsageTable } from "./model-usage-table";
import { LearningAgentModelSettings } from "./learning-agent-model-settings";

export default async function ModelUsageListing() {
  const result = await getModelUsageData();
  const rows = [...result.platformRows, ...result.organizationRows];

  return (
    <ManagementPage
      eyebrow="平台运营"
      title="模型用量"
      description={
        result.canViewAllTenants
          ? "分别查看 Qwen、DeepSeek 及其他模型在平台与各机构的调用规模、输入输出构成和最近趋势。"
          : "查看当前机构的模型调用总量、输入输出构成和最近趋势。"
      }
      icon={Activity}
      meta={
        <>
          <span>{rows.length} 个用量主体</span>
          <span>最近 {result.queryLimit.toLocaleString("zh-CN")} 条调用</span>
        </>
      }
    >
      {result.hasQueryError && (
        <ManagementNotice tone="warning">
          暂时无法读取完整的模型用量或机构数据，请稍后刷新重试。
        </ManagementNotice>
      )}
      <ModelUsageTable
        data={rows}
        canViewAllTenants={result.canViewAllTenants}
        queryLimit={result.queryLimit}
      />
      {result.canViewAllTenants && (
        <LearningAgentModelSettings configs={result.agentModelConfigs} />
      )}
    </ManagementPage>
  );
}
