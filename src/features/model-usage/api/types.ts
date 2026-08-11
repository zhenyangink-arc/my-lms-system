export type ModelUsageScope = "platform" | "tenant";

export type ModelUsageRecord = {
  tenant_id: string;
  user_id: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  created_at: string;
};

export type ModelUsageTenant = {
  id: string;
  name: string;
  slug: string;
};

export type ModelUsageLog = {
  createdAt: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type ModelUsageSubjectKind = "platform" | "organization";

export type ModelUsageTableRow = {
  id: string;
  name: string;
  slug: string;
  kind: ModelUsageSubjectKind;
  isCurrent: boolean;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  dayTokens: number;
  logCount: number;
  trend: number[];
  logs: ModelUsageLog[];
  activity: ModelUsageLog[];
};

export type ModelUsageTotals = {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  dayTokens: number;
};

export type ModelUsageResult = {
  scope: ModelUsageScope;
  viewerRole: string;
  tenantId: string | null;
  canViewAllTenants: boolean;
  queryLimit: number;
  hasQueryError: boolean;
  totals: ModelUsageTotals;
  platformRows: ModelUsageTableRow[];
  organizationRows: ModelUsageTableRow[];
};
