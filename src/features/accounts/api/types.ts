export type AccountScope = "platform" | "tenant";

export type AccountListProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  login_id?: string | null;
  role: string;
  status: string;
  created_at: string;
  registered_at: string | null;
  updated_at: string | null;
  last_active_at: string | null;
  profile_completed_at: string | null;
  registration_source: string | null;
  deactivate_reason: string | null;
  membership_tier: string;
  global_role: string | null;
};

export type AccountDetail = AccountListProfile & {
  avatar_path: string | null;
  gender: string | null;
  birth_date: string | null;
  address_province: string | null;
  address_city: string | null;
  education_level: string | null;
  education_status: string | null;
  education_completion_month: string | null;
  academic_average: number | null;
  gaokao_has_score: boolean | null;
  gaokao_score: number | null;
  english_level: string | null;
  math_level: string | null;
  has_korean: boolean | null;
  topik_level: number | null;
  has_work_experience: boolean | null;
};

export type AccountAuditLog = {
  id: number;
  actor_id: string | null;
  target_user_id: string;
  action: string;
  changed_fields: string[] | null;
  created_at: string;
};

export type AccountDeletionAuditLog = {
  id: number;
  target_user_id: string;
  target_email: string | null;
  target_full_name: string | null;
  target_role: string | null;
  deletion_reason: string;
  related_data_counts: Record<string, number> | null;
  deleted_at: string;
};

export type AccountDetailAuditLog = {
  id: number;
  actor_id: string | null;
  action: string;
  changed_fields: string[] | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
};

export type AccountSearchParams = {
  role?: string;
  status?: string;
  membership?: string;
  profile?: string;
  q?: string;
  sort?: string;
  deleted?: string;
};

export type AccountFilters = {
  role: string;
  status: string;
  membership: string;
  profile: string;
  query: string;
  sort: string;
};

export type AccountListResult = {
  scope: AccountScope;
  tenantId: string | null;
  viewerRole: string;
  allProfiles: AccountListProfile[];
  profiles: AccountListProfile[];
  auditLogs: AccountAuditLog[];
  deletionAuditLogs: AccountDeletionAuditLog[];
  accountNames: Record<string, string>;
  filters: AccountFilters;
  hasFilters: boolean;
  deletedStatus: "cleanup" | "success" | null;
  hasError: boolean;
};

export type AccountDetailResult = {
  scope: AccountScope;
  tenantId: string | null;
  viewerRole: string;
  profile: AccountDetail;
  auditLogs: AccountDetailAuditLog[];
  actorNames: Map<string, string>;
  avatarUrl: string | null;
  completionPercent: number;
  displayName: string;
};

export type CreateManagedAccountInput = {
  full_name: string;
  login_id: string;
  initial_password: string;
  role: "teacher" | "student";
  tenant_id: string;
};

export type CreatePlatformAccountInput = {
  full_name: string;
  login_id: string;
  initial_password: string;
  role: "platform_deputy" | "platform_admin" | "platform_course_inspector";
};

export type UpdateAccountRoleInput = { role: string };
export type UpdateAccountStatusInput = {
  status: "active" | "inactive" | "suspended";
  deactivate_reason: string;
};
export type UpdateMembershipTierInput = {
  membership_tier: "normal" | "vip1" | "vip2" | "vip3";
};
export type DeleteAccountInput = {
  confirmation: string;
  deletion_reason: string;
};
