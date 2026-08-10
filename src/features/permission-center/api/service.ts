import "server-only";

import { requirePlatformOwner } from "@/lib/admin";
import {
  ASSIGNABLE_PERMISSION_KEYS,
  ASSIGNABLE_PERMISSION_LABELS,
  PERMISSION_MODULES,
  PERMISSION_ROLE_LABELS,
  PLATFORM_PERMISSION_ROLES,
  TENANT_PERMISSION_ROLES,
  roleHasCapability,
  type AssignablePermissionKey,
  type PermissionRole,
} from "@/lib/permissions/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ActivePermissionGrant,
  PermissionCenterData,
  PermissionCenterDirectory,
  PermissionCenterIdentity,
  PermissionCenterTenant,
  PermissionGrantAuditEntry,
} from "./types";

const PERMISSION_AUDIT_LIMIT = 200;

type PermissionGrantRow = {
  id: number;
  scope_type: "platform" | "tenant";
  tenant_id: string | null;
  subject_user_id: string;
  permission_key: AssignablePermissionKey;
  granted_by: string;
  granted_at: string;
};

type PermissionAuditRow = {
  id: number;
  permission_grant_id: number | null;
  actor_id: string | null;
  subject_user_id: string;
  tenant_id: string | null;
  permission_key: AssignablePermissionKey;
  action: "granted" | "revoked";
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  login_id: string | null;
  role: string;
  global_role: string | null;
  membership_tier: string | null;
  status: string | null;
};

const PERMISSION_ROLES = [
  ...PLATFORM_PERMISSION_ROLES,
  ...TENANT_PERMISSION_ROLES,
] as const;

function createPermissionDirectory(): PermissionCenterDirectory {
  const roles = [...PERMISSION_ROLES];
  const modules = PERMISSION_MODULES.map((module) => ({
    key: module.key,
    label: module.label,
    group: module.group,
    description: module.description,
    capabilities: module.capabilities.map((capability) => ({
      key: capability.key,
      label: capability.label,
      description: capability.description,
      platformRoles: [...(capability.platformRoles ?? [])],
      tenantRoles: [...(capability.tenantRoles ?? [])],
      explicitGrant: capability.explicitGrant ?? null,
      studentMinimumTier: capability.studentMinimumTier ?? null,
      fixed: capability.fixed === true,
    })),
  }));

  const roleCapabilities = Object.fromEntries(
    roles.map((role) => [
      role,
      PERMISSION_MODULES.flatMap((module) =>
        module.capabilities
          .filter((capability) => roleHasCapability(role, capability))
          .map((capability) => capability.key),
      ),
    ]),
  ) as Record<PermissionRole, string[]>;

  return {
    assignablePermissionKeys: [...ASSIGNABLE_PERMISSION_KEYS],
    assignablePermissionLabels: { ...ASSIGNABLE_PERMISSION_LABELS },
    roles,
    roleLabels: { ...PERMISSION_ROLE_LABELS },
    roleCapabilities,
    modules,
  };
}

function toIdentity(row: ProfileRow): PermissionCenterIdentity {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    loginId: row.login_id,
    role: row.role,
    globalRole: row.global_role,
    membershipTier: row.membership_tier,
    status: row.status,
  };
}

export async function getPermissionCenterData(): Promise<PermissionCenterData> {
  // 权限中心所有读取都先经过平台负责人校验；Admin Client 只在校验成功后创建。
  const viewer = await requirePlatformOwner();
  const admin = createAdminClient();

  const [tenantResult, grantResult, auditResult] = await Promise.all([
    admin.from("tenants").select("id,name,slug,status").order("name"),
    admin
      .from("permission_grants")
      .select(
        "id,scope_type,tenant_id,subject_user_id,permission_key,granted_by,granted_at",
      )
      .is("revoked_at", null)
      .order("granted_at", { ascending: false }),
    admin
      .from("permission_grant_audit_logs")
      .select(
        "id,permission_grant_id,actor_id,subject_user_id,tenant_id,permission_key,action,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(PERMISSION_AUDIT_LIMIT),
  ]);

  if (tenantResult.error || grantResult.error || auditResult.error) {
    throw new Error("无法读取统一权限中心数据，请稍后重试。");
  }

  const grantRows = (grantResult.data ?? []) as PermissionGrantRow[];
  const auditRows = (auditResult.data ?? []) as PermissionAuditRow[];
  const profileIds = [
    ...new Set([
      ...grantRows.flatMap((grant) => [
        grant.subject_user_id,
        grant.granted_by,
      ]),
      ...auditRows.flatMap((entry) =>
        [entry.subject_user_id, entry.actor_id].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    ]),
  ];

  // 延续现有权限中心设计：只读取展示授权主体和操作人所需的身份字段。
  const profileResult = profileIds.length
    ? await admin
        .from("profiles")
        .select(
          "id,full_name,email,login_id,role,global_role,membership_tier,status",
        )
        .in("id", profileIds)
    : { data: [] as ProfileRow[], error: null };

  if (profileResult.error) {
    throw new Error("无法读取权限账号资料，请稍后重试。");
  }

  const identities = new Map(
    ((profileResult.data ?? []) as ProfileRow[]).map((profile) => {
      const identity = toIdentity(profile);
      return [identity.id, identity] as const;
    }),
  );

  const activeGrants: ActivePermissionGrant[] = grantRows.map((grant) => ({
    id: grant.id,
    scopeType: grant.scope_type,
    tenantId: grant.tenant_id,
    subjectUserId: grant.subject_user_id,
    permissionKey: grant.permission_key,
    grantedByUserId: grant.granted_by,
    grantedAt: grant.granted_at,
    subject: identities.get(grant.subject_user_id) ?? null,
    grantedBy: identities.get(grant.granted_by) ?? null,
  }));

  const auditLogs: PermissionGrantAuditEntry[] = auditRows.map((entry) => ({
    id: entry.id,
    permissionGrantId: entry.permission_grant_id,
    actorId: entry.actor_id,
    subjectUserId: entry.subject_user_id,
    tenantId: entry.tenant_id,
    permissionKey: entry.permission_key,
    action: entry.action,
    createdAt: entry.created_at,
    actor: entry.actor_id ? identities.get(entry.actor_id) ?? null : null,
    subject: identities.get(entry.subject_user_id) ?? null,
  }));

  return {
    viewer: {
      userId: viewer.user.id,
      role: "platform_super_admin",
    },
    directory: createPermissionDirectory(),
    tenants: (tenantResult.data ?? []) as PermissionCenterTenant[],
    activeGrants,
    auditLogs,
  };
}
