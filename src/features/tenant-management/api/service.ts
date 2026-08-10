import "server-only";

import {
  requirePlatformTenantManager,
  type UserRole,
} from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  PlatformDeputySummary,
  TenantLifecycleAuditItem,
  TenantLifecycleAuditRow,
  TenantListItem,
  TenantManagementData,
  TenantManagementDetailData,
  TenantManagementHistoryData,
  TenantManagementViewer,
  TenantManagerSummary,
  TenantMembershipAuditItem,
  TenantMembershipAuditRow,
  TenantMembershipRow,
  TenantProfileRow,
  TenantRow,
} from "./types";

const TENANT_HISTORY_LIMIT = 100;

function isTenancySchemaUnavailable(error: { code?: string } | null) {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

function createViewer(role: UserRole): TenantManagementViewer {
  if (role !== "platform_super_admin" && role !== "tenant_operator") {
    throw new Error("当前账号没有租户生命周期管理权限。");
  }
  const isOwner = role === "platform_super_admin";
  return {
    scope: "platform",
    role,
    kind: isOwner ? "owner" : "deputy",
    canCreatePlatformDeputy: isOwner,
    canCreateTenant: true,
    canManageLifecycle: true,
    canPermanentlyDelete: true,
  };
}

function profileName(profile: TenantProfileRow | undefined, fallback: string) {
  return profile?.full_name?.trim() || profile?.email?.trim() || fallback;
}

function profileLoginId(profile: TenantProfileRow | undefined) {
  return profile?.login_id?.trim() || "历史账号";
}

function managersByTenant(
  memberships: TenantMembershipRow[],
  profilesById: Map<string, TenantProfileRow>,
) {
  const result = new Map<string, TenantManagerSummary[]>();
  for (const membership of memberships) {
    if (
      membership.role !== "tenant_super_admin" ||
      membership.status !== "active"
    ) {
      continue;
    }
    const profile = profilesById.get(membership.user_id);
    const managers = result.get(membership.tenant_id) ?? [];
    managers.push({
      id: membership.user_id,
      name: profileName(profile, "未填写姓名"),
      loginId: profileLoginId(profile),
    });
    result.set(membership.tenant_id, managers);
  }
  return result;
}

function createTenantListItems(
  tenants: TenantRow[],
  memberships: TenantMembershipRow[],
  profilesById: Map<string, TenantProfileRow>,
) {
  const memberCounts = new Map<string, number>();
  for (const membership of memberships) {
    memberCounts.set(
      membership.tenant_id,
      (memberCounts.get(membership.tenant_id) ?? 0) + 1,
    );
  }
  const managerGroups = managersByTenant(memberships, profilesById);

  return tenants.map(
    (tenant): TenantListItem => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      planKey: tenant.plan_key,
      createdAt: tenant.created_at,
      updatedAt: tenant.updated_at,
      memberCount: memberCounts.get(tenant.id) ?? 0,
      managers: managerGroups.get(tenant.id) ?? [],
    }),
  );
}

async function getProfilesById(userIds: string[]) {
  if (userIds.length === 0) {
    return {
      profilesById: new Map<string, TenantProfileRow>(),
      hasError: false,
    };
  }

  // 平台租户管理沿用既有设计：通过 Admin Client 读取最小必要身份字段，
  // 不受 profiles 的机构 RLS 限制，也不扩大到其他个人资料字段。
  const result = await createAdminClient()
    .from("profiles")
    .select("id,full_name,login_id,email")
    .in("id", userIds);

  return {
    profilesById: new Map(
      ((result.data ?? []) as TenantProfileRow[]).map((profile) => [
        profile.id,
        profile,
      ]),
    ),
    hasError: Boolean(result.error),
  };
}

async function getActivePlatformDeputies(): Promise<{
  deputies: PlatformDeputySummary[];
  hasError: boolean;
}> {
  const result = await createAdminClient()
    .from("profiles")
    .select("id,full_name,login_id")
    .eq("role", "tenant_operator")
    .eq("global_role", "platform_deputy")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  return {
    deputies: ((result.data ?? []) as TenantProfileRow[]).map((profile) => ({
      id: profile.id,
      name: profileName(profile, "未填写姓名"),
      loginId: profileLoginId(profile),
    })),
    hasError: Boolean(result.error),
  };
}

export async function getTenantManagementData(): Promise<TenantManagementData> {
  const { supabase, role } = await requirePlatformTenantManager();
  const viewer = createViewer(role);
  const tenantResult = await supabase
    .from("tenants")
    .select("id,name,slug,status,plan_key,settings,created_at,updated_at")
    .order("created_at", { ascending: false });

  const tenants = (tenantResult.data ?? []) as TenantRow[];
  const tenantIds = tenants.map((tenant) => tenant.id);
  const membershipResult = tenantIds.length
    ? await supabase
        .from("tenant_memberships")
        .select(
          "tenant_id,user_id,role,status,membership_tier,created_at",
        )
        .in("tenant_id", tenantIds)
    : { data: [] as TenantMembershipRow[], error: null };

  const memberships = (membershipResult.data ?? []) as TenantMembershipRow[];
  const memberIds = [...new Set(memberships.map((item) => item.user_id))];
  const [profileResult, deputyResult] = await Promise.all([
    getProfilesById(memberIds),
    getActivePlatformDeputies(),
  ]);
  const items = createTenantListItems(
    tenants,
    memberships,
    profileResult.profilesById,
  );

  return {
    viewer,
    tenants: items,
    deputies: deputyResult.deputies,
    summary: {
      totalTenants: tenants.length,
      activeTenants: tenants.filter((tenant) => tenant.status === "active")
        .length,
      inactiveTenants: tenants.filter((tenant) => tenant.status !== "active")
        .length,
      totalMemberships: memberships.length,
    },
    schemaUnavailable: isTenancySchemaUnavailable(tenantResult.error),
    hasQueryError: Boolean(
      tenantResult.error ||
        membershipResult.error ||
        profileResult.hasError ||
        deputyResult.hasError,
    ),
  };
}

export async function getTenantManagementDetailData(
  tenantId: string,
): Promise<TenantManagementDetailData | null> {
  const { supabase, role } = await requirePlatformTenantManager();
  const [tenantResult, membershipResult] = await Promise.all([
    supabase
      .from("tenants")
      .select("id,name,slug,status,plan_key,settings,created_at,updated_at")
      .eq("id", tenantId)
      .maybeSingle(),
    supabase
      .from("tenant_memberships")
      .select("tenant_id,user_id,role,status,membership_tier,created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true }),
  ]);

  if (tenantResult.error || membershipResult.error || !tenantResult.data) {
    return null;
  }

  const tenant = tenantResult.data as TenantRow;
  const memberships = (membershipResult.data ?? []) as TenantMembershipRow[];
  const profileResult = await getProfilesById(
    [...new Set(memberships.map((membership) => membership.user_id))],
  );
  const managers = managersByTenant(
    memberships,
    profileResult.profilesById,
  ).get(tenantId) ?? [];

  return {
    viewer: createViewer(role),
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      planKey: tenant.plan_key,
      settings: tenant.settings,
      createdAt: tenant.created_at,
      updatedAt: tenant.updated_at,
    },
    members: memberships.map((membership) => {
      const profile = profileResult.profilesById.get(membership.user_id);
      return {
        userId: membership.user_id,
        name: profileName(profile, "未填写姓名"),
        loginId: profileLoginId(profile),
        role: membership.role,
        status: membership.status,
        membershipTier: membership.membership_tier,
        createdAt: membership.created_at,
      };
    }),
    managers,
  };
}

export async function getTenantManagementHistoryData(): Promise<TenantManagementHistoryData> {
  const { supabase, role } = await requirePlatformTenantManager();
  const [recoverableResult, lifecycleResult, membershipAuditResult] =
    await Promise.all([
      supabase
        .from("tenants")
        .select("id,name,slug,status,plan_key,settings,created_at,updated_at")
        .in("status", ["suspended", "archived"])
        .order("updated_at", { ascending: false }),
      supabase
        .from("tenant_lifecycle_audit_logs")
        .select(
          "id,tenant_id,tenant_slug,actor_id,action,details,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(TENANT_HISTORY_LIMIT),
      supabase
        .from("tenant_membership_audit_logs")
        .select(
          "id,tenant_id,actor_id,target_user_id,operation,before_data,after_data,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(TENANT_HISTORY_LIMIT),
    ]);

  const recoverableTenants = (recoverableResult.data ?? []) as TenantRow[];
  const lifecycleRows = (lifecycleResult.data ?? []) as TenantLifecycleAuditRow[];
  const membershipRows = (membershipAuditResult.data ?? []) as TenantMembershipAuditRow[];
  const tenantIds = [...new Set(membershipRows.map((item) => item.tenant_id))];
  const profileIds = [
    ...new Set(
      [
        ...lifecycleRows.map((item) => item.actor_id),
        ...membershipRows.flatMap((item) => [
          item.actor_id,
          item.target_user_id,
        ]),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];

  const [tenantNamesResult, profileResult] = await Promise.all([
    tenantIds.length
      ? supabase.from("tenants").select("id,name,slug").in("id", tenantIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; name: string; slug: string }>,
          error: null,
        }),
    getProfilesById(profileIds),
  ]);
  const tenantNamesById = new Map(
    (tenantNamesResult.data ?? []).map((tenant) => [tenant.id, tenant]),
  );

  const lifecycleLogs: TenantLifecycleAuditItem[] = lifecycleRows.map(
    (item) => ({
      id: item.id,
      tenantId: item.tenant_id,
      tenantSlug: item.tenant_slug,
      actorId: item.actor_id,
      actorName: item.actor_id
        ? profileName(
            profileResult.profilesById.get(item.actor_id),
            `账号 …${item.actor_id.slice(-6)}`,
          )
        : "系统",
      action: item.action,
      details: item.details,
      createdAt: item.created_at,
    }),
  );
  const membershipLogs: TenantMembershipAuditItem[] = membershipRows.map(
    (item) => {
      const tenant = tenantNamesById.get(item.tenant_id);
      return {
        id: item.id,
        tenantId: item.tenant_id,
        tenantName: tenant?.name ?? "已删除或未知机构",
        tenantSlug: tenant?.slug ?? "未知机构",
        actorId: item.actor_id,
        actorName: item.actor_id
          ? profileName(
              profileResult.profilesById.get(item.actor_id),
              `账号 …${item.actor_id.slice(-6)}`,
            )
          : "系统",
        targetUserId: item.target_user_id,
        targetUserName: profileName(
          profileResult.profilesById.get(item.target_user_id),
          `账号 …${item.target_user_id.slice(-6)}`,
        ),
        operation: item.operation,
        before: item.before_data,
        after: item.after_data,
        createdAt: item.created_at,
      };
    },
  );

  return {
    viewer: createViewer(role),
    recoverableTenants: createTenantListItems(
      recoverableTenants,
      [],
      new Map(),
    ),
    lifecycleLogs,
    membershipLogs,
    hasQueryError: Boolean(
      recoverableResult.error ||
        lifecycleResult.error ||
        membershipAuditResult.error ||
        tenantNamesResult.error ||
        profileResult.hasError,
    ),
  };
}
