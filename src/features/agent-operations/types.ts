export type AgentNavigationRule = {
  id: string;
  name: string;
  triggerPhrases: string[];
  actionType: "navigate" | "highlight";
  targetPath: string;
  targetElementId: string | null;
  responseText: string;
  priority: number;
  status: "enabled" | "disabled";
  updatedAt: string;
};

export type AgentRuleVersion = {
  id: string;
  ruleId: string;
  versionNumber: number;
  name: string;
  changeType: "created" | "updated" | "enabled" | "disabled" | "deleted" | "rollback";
  sourceVersionNumber: number | null;
  actorName: string;
  createdAt: string;
};

export type AgentDeletedRuleSummary = {
  ruleId: string;
  name: string;
  lastVersionNumber: number;
  deletedAt: string;
};

export type AgentConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions: Array<Record<string, unknown>>;
  provider: string | null;
  model: string | null;
  responseMode: "local_rule" | "model" | null;
  firstTokenMs: number | null;
  totalDurationMs: number | null;
  createdAt: string;
};

export type AgentConversation = {
  id: string;
  studentName: string;
  tenantName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages: AgentConversationMessage[];
  failures: AgentConversationFailure[];
};

export type AgentConversationFailure = {
  id: string;
  userMessageId: string;
  stage: "environment" | "upstream" | "stream" | "persistence" | "historical";
  errorCode: string;
  provider: string | null;
  model: string | null;
  publicMessage: string;
  durationMs: number | null;
  createdAt: string;
};

export type AgentAuditLog = {
  id: string;
  action: string;
  summary: string;
  actorName: string;
  createdAt: string;
};

export type AgentOperationsData = {
  metrics: {
    conversations: number;
    studentQuestions: number;
    localRuleReplies: number;
    modelReplies: number;
    failedRequests: number;
    failureRate: number;
    averageFirstTokenMs: number | null;
  };
  conversations: AgentConversation[];
  conversationTotal: number;
  conversationPage: number;
  conversationPageSize: number;
  rules: AgentNavigationRule[];
  deletedRules: AgentDeletedRuleSummary[];
  modelConfig: {
    agentCode: string;
    displayName: string;
    subjectCode: string;
    provider: "qwen" | "deepseek";
    model: string;
  } | null;
  behaviorConfig: {
    systemPrompt: string;
    maxOutputCharacters: number;
  } | null;
  auditLogs: AgentAuditLog[];
  hasQueryError: boolean;
};
