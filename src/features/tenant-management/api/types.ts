export type TenantLifecycleStatus = "active" | "suspended" | "archived";

export type TenantManagerViewerRole =
  | "platform_super_admin"
  | "tenant_operator";

export type TenantManagementViewer = {
  scope: "platform";
  role: TenantManagerViewerRole;
  kind: "owner" | "deputy";
  canCreatePlatformDeputy: boolean;
  canCreateTenant: true;
  canManageLifecycle: true;
  canPermanentlyDelete: true;
};

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: TenantLifecycleStatus;
  plan_key: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type TenantMembershipRow = {
  tenant_id: string;
  user_id: string;
  role: string;
  status: string;
  membership_tier: string;
  created_at: string;
};

export type TenantProfileRow = {
  id: string;
  full_name: string | null;
  login_id: string | null;
  email?: string | null;
};

export type TenantManagerSummary = {
  id: string;
  name: string;
  loginId: string;
};

export type TenantListItem = {
  id: string;
  name: string;
  slug: string;
  status: TenantLifecycleStatus;
  planKey: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  managers: TenantManagerSummary[];
};

export type PlatformDeputySummary = {
  id: string;
  name: string;
  loginId: string;
};

export type TenantManagementSummary = {
  totalTenants: number;
  activeTenants: number;
  inactiveTenants: number;
  totalMemberships: number;
};

export type TenantManagementData = {
  viewer: TenantManagementViewer;
  tenants: TenantListItem[];
  deputies: PlatformDeputySummary[];
  summary: TenantManagementSummary;
  schemaUnavailable: boolean;
  hasQueryError: boolean;
};

export type TenantMemberDetail = {
  userId: string;
  name: string;
  loginId: string;
  role: string;
  status: string;
  membershipTier: string;
  createdAt: string;
};

export type TenantManagementDetailData = {
  viewer: TenantManagementViewer;
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: TenantLifecycleStatus;
    planKey: string;
    settings: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  };
  members: TenantMemberDetail[];
  managers: TenantManagerSummary[];
};

export type TenantLifecycleAction =
  | "suspended"
  | "archived"
  | "restored"
  | "permanently_deleted";

export type TenantLifecycleAuditRow = {
  id: number;
  tenant_id: string;
  tenant_slug: string;
  actor_id: string | null;
  action: TenantLifecycleAction;
  details: Record<string, unknown>;
  created_at: string;
};

export type TenantLifecycleAuditItem = {
  id: number;
  tenantId: string;
  tenantSlug: string;
  actorId: string | null;
  actorName: string;
  action: TenantLifecycleAction;
  details: Record<string, unknown>;
  createdAt: string;
};

export type TenantMembershipAuditOperation = "insert" | "update" | "delete";

export type TenantMembershipAuditSnapshot = {
  role?: string;
  status?: string;
  membership_tier?: string;
  [key: string]: unknown;
};

export type TenantMembershipAuditRow = {
  id: number;
  tenant_id: string;
  actor_id: string | null;
  target_user_id: string;
  operation: TenantMembershipAuditOperation;
  before_data: TenantMembershipAuditSnapshot | null;
  after_data: TenantMembershipAuditSnapshot | null;
  created_at: string;
};

export type TenantMembershipAuditItem = {
  id: number;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  actorId: string | null;
  actorName: string;
  targetUserId: string;
  targetUserName: string;
  operation: TenantMembershipAuditOperation;
  before: TenantMembershipAuditSnapshot | null;
  after: TenantMembershipAuditSnapshot | null;
  createdAt: string;
};

export type TenantManagementHistoryData = {
  viewer: TenantManagementViewer;
  recoverableTenants: TenantListItem[];
  lifecycleLogs: TenantLifecycleAuditItem[];
  membershipLogs: TenantMembershipAuditItem[];
  hasQueryError: boolean;
};
