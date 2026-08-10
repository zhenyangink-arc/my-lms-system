import type {
  AssignablePermissionKey,
  PermissionMembershipTier,
  PermissionRole,
} from "@/lib/permissions/catalog";

export type PermissionCenterScope = "platform" | "tenant";

export type PermissionCenterCapability = {
  key: string;
  label: string;
  description: string;
  platformRoles: PermissionRole[];
  tenantRoles: PermissionRole[];
  explicitGrant: AssignablePermissionKey | null;
  studentMinimumTier: PermissionMembershipTier | null;
  fixed: boolean;
};

export type PermissionCenterModule = {
  key: string;
  label: string;
  group: string;
  description: string;
  capabilities: PermissionCenterCapability[];
};

export type PermissionCenterDirectory = {
  assignablePermissionKeys: AssignablePermissionKey[];
  assignablePermissionLabels: Record<AssignablePermissionKey, string>;
  roles: PermissionRole[];
  roleLabels: Record<PermissionRole, string>;
  roleCapabilities: Record<PermissionRole, string[]>;
  modules: PermissionCenterModule[];
};

export type PermissionCenterTenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type PermissionCenterIdentity = {
  id: string;
  fullName: string | null;
  email: string | null;
  loginId: string | null;
  role: string;
  globalRole: string | null;
  membershipTier: string | null;
  status: string | null;
};

export type TenantPermissionGrantCandidate = {
  tenantId: string;
  account: PermissionCenterIdentity;
};

export type ActivePermissionGrant = {
  id: number;
  scopeType: PermissionCenterScope;
  tenantId: string | null;
  subjectUserId: string;
  permissionKey: AssignablePermissionKey;
  grantedByUserId: string;
  grantedAt: string;
  subject: PermissionCenterIdentity | null;
  grantedBy: PermissionCenterIdentity | null;
};

export type PermissionGrantAuditEntry = {
  id: number;
  permissionGrantId: number | null;
  actorId: string | null;
  subjectUserId: string;
  tenantId: string | null;
  permissionKey: AssignablePermissionKey;
  action: "granted" | "revoked";
  createdAt: string;
  actor: PermissionCenterIdentity | null;
  subject: PermissionCenterIdentity | null;
};

export type PermissionCenterData = {
  viewer: {
    userId: string;
    role: "platform_super_admin";
  };
  directory: PermissionCenterDirectory;
  tenants: PermissionCenterTenant[];
  platformGrantCandidates: PermissionCenterIdentity[];
  tenantGrantCandidates: TenantPermissionGrantCandidate[];
  activeGrants: ActivePermissionGrant[];
  auditLogs: PermissionGrantAuditEntry[];
};
