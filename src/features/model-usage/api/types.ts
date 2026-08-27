export type ModelUsageScope = "platform" | "tenant";
export type ModelUsageProvider = "qwen" | "deepseek" | "self_hosted" | "unknown";

export type LearningAgentModelConfig = {
  agentCode: string;
  displayName: string;
  subjectCode: string;
  provider: "qwen" | "deepseek";
  model: string;
};

export type ModelUsageRecord = {
  tenant_id: string;
  user_id: string | null;
  provider: ModelUsageProvider;
  model: string;
  feature_code: string;
  agent_code: string | null;
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
  provider: ModelUsageProvider;
  model: string;
  featureCode: string;
  agentCode: string | null;
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
  provider: ModelUsageProvider;
  model: string;
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
  agentModelConfigs: LearningAgentModelConfig[];
  totals: ModelUsageTotals;
  platformRows: ModelUsageTableRow[];
  organizationRows: ModelUsageTableRow[];
};
