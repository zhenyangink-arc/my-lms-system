export type CompletionGapStatistic = {
  key: string;
  category: string;
  title: string;
  count: number;
};

export type InstitutionCompletionStatistics = {
  scope: "institution";
  tenantId: string;
  totalEvaluations: number;
  eligibleCount: number;
  eligibleRate: number;
  issuedCount: number;
  issuanceRate: number;
  missingRequirementCount: number;
  gaps: CompletionGapStatistic[];
};

export type PlatformCompletionTrendPoint = {
  periodStart: string;
  policyId: string;
  policyCode: string;
  policyVersion: number;
  policyTitle: string;
  institutionCount: number;
  totalEvaluations: number;
  eligibleCount: number;
  eligibleRate: number;
  issuedCount: number;
  issuanceRate: number;
};

export type PlatformCompletionStatistics = {
  scope: "platform";
  trend: PlatformCompletionTrendPoint[];
};

export type CompletionStatistics =
  | InstitutionCompletionStatistics
  | PlatformCompletionStatistics;

function recordValue(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`结课统计返回的${label}格式不正确。`);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, label: string) {
  if (typeof value !== "string" || !value) {
    throw new Error(`结课统计返回的${label}格式不正确。`);
  }
  return value;
}

function numberValue(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`结课统计返回的${label}格式不正确。`);
  }
  return value;
}

function arrayValue(value: unknown, label: string) {
  if (!Array.isArray(value)) {
    throw new Error(`结课统计返回的${label}格式不正确。`);
  }
  return value;
}

export function parseCompletionStatistics(value: unknown): CompletionStatistics {
  const source = recordValue(value, "数据");

  if (source.scope === "institution") {
    return {
      scope: "institution",
      tenantId: stringValue(source.tenantId, "机构编号"),
      totalEvaluations: numberValue(source.totalEvaluations, "资格记录数"),
      eligibleCount: numberValue(source.eligibleCount, "符合资格数"),
      eligibleRate: numberValue(source.eligibleRate, "符合资格率"),
      issuedCount: numberValue(source.issuedCount, "有效证书数"),
      issuanceRate: numberValue(source.issuanceRate, "颁发率"),
      missingRequirementCount: numberValue(
        source.missingRequirementCount,
        "缺口总数",
      ),
      gaps: arrayValue(source.gaps, "缺口分布").map((item, index) => {
        const gap = recordValue(item, `第 ${index + 1} 条缺口`);
        return {
          key: stringValue(gap.key, "缺口键"),
          category: stringValue(gap.category, "缺口类别"),
          title: stringValue(gap.title, "缺口名称"),
          count: numberValue(gap.count, "缺口次数"),
        };
      }),
    };
  }

  if (source.scope === "platform") {
    return {
      scope: "platform",
      trend: arrayValue(source.trend, "趋势数据").map((item, index) => {
        const point = recordValue(item, `第 ${index + 1} 条趋势`);
        return {
          periodStart: stringValue(point.periodStart, "统计月份"),
          policyId: stringValue(point.policyId, "政策编号"),
          policyCode: stringValue(point.policyCode, "政策代码"),
          policyVersion: numberValue(point.policyVersion, "政策版本"),
          policyTitle: stringValue(point.policyTitle, "政策名称"),
          institutionCount: numberValue(point.institutionCount, "机构数"),
          totalEvaluations: numberValue(point.totalEvaluations, "资格记录数"),
          eligibleCount: numberValue(point.eligibleCount, "符合资格数"),
          eligibleRate: numberValue(point.eligibleRate, "符合资格率"),
          issuedCount: numberValue(point.issuedCount, "有效证书数"),
          issuanceRate: numberValue(point.issuanceRate, "颁发率"),
        };
      }),
    };
  }

  throw new Error("结课统计返回的查看范围不正确。");
}
