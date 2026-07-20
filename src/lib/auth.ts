import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type AuthProfile = {
  full_name: string | null;
  role: string | null;
  global_role: string | null;
  status: string | null;
  membership_tier: string | null;
};

function isPlatformOnlyProfile(profile: AuthProfile | null | undefined) {
  if (profile?.global_role) {
    // 平台身份直接绕过租户归属检查，不伪装成任何机构成员。
    return profile.global_role === "platform_owner" || profile.global_role === "platform_deputy";
  }

  // 缺少 global_role 时只认可无歧义的历史副负责人角色；平台负责人必须完成身份迁移。
  return profile?.role === "tenant_operator";
}

function normalizePlatformProfile(profile: AuthProfile | null) {
  if (!profile) return profile;

  if (profile.global_role === "platform_owner") {
    return { ...profile, role: "platform_super_admin" };
  }

  if (profile.global_role === "platform_deputy") {
    return { ...profile, role: "tenant_operator" };
  }

  return profile;
}

type AuthTenantMembership = {
  tenant_id: string;
  role: string;
  status: string;
  membership_tier: string;
  is_default: boolean;
};

type AuthTenantRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  plan_key: string;
};

export type AuthTenantContext = {
  id: string;
  slug: string;
  name: string;
  status: string;
  planKey: string;
  role: string;
  membershipTier: string;
};

type SupabaseQueryError = {
  code?: string;
};

function isTenancySchemaUnavailable(error: SupabaseQueryError | null) {
  return error?.code === "PGRST205" || error?.code === "42P01";
}

export function isActiveProfileStatus(status: string | null | undefined) {
  return !status || status === "active";
}

/**
 * 当前请求的统一认证上下文。
 *
 * React cache 避免同一次服务端渲染中，layout、topbar 和页面重复查询
 * auth user 与 profiles。这里仍使用 getUser()，不信任未经服务端验证的会话数据。
 */
export const getAuthContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "unauthenticated" as const, supabase };
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, role, global_role, status, membership_tier")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error("无法读取当前用户资料，请稍后重试。");
  }

  const profile = profileData as AuthProfile | null;

  if (!isActiveProfileStatus(profile?.status)) {
    return {
      status: "inactive" as const,
      supabase,
      user,
      profile,
    };
  }

  const normalizedPlatformProfile = normalizePlatformProfile(profile);
  const legacyActiveContext = {
    status: "active" as const,
    supabase,
    user,
    profile: normalizedPlatformProfile,
    platformProfile: normalizedPlatformProfile,
    tenant: null,
  };

  // 平台身份不进入任何租户业务上下文；历史残留的成员关系也不能改变其平台空间。
  if (isPlatformOnlyProfile(profile)) {
    return legacyActiveContext;
  }

  const { data: membershipData, error: membershipError } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role, status, membership_tier, is_default")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    // 允许应用代码先于多租户控制面迁移部署，避免历史账号被全部锁在 Dashboard 外。
    if (isTenancySchemaUnavailable(membershipError)) {
      return legacyActiveContext;
    }

    throw new Error("无法读取当前租户成员关系，请稍后重试。");
  }

  const membership = membershipData as AuthTenantMembership | null;

  if (!membership) {
    throw new Error("当前账号尚未加入可用租户，请联系管理员。");
  }

  const { data: tenantData, error: tenantError } = await supabase
    .from("tenants")
    .select("id, slug, name, status, plan_key")
    .eq("id", membership.tenant_id)
    .eq("status", "active")
    .maybeSingle();

  if (tenantError) {
    if (isTenancySchemaUnavailable(tenantError)) {
      return legacyActiveContext;
    }

    throw new Error("无法读取当前租户，请稍后重试。");
  }

  const tenantRow = tenantData as AuthTenantRow | null;

  if (!tenantRow) {
    throw new Error("当前租户不可用，请联系管理员。");
  }

  const tenant: AuthTenantContext = {
    id: tenantRow.id,
    slug: tenantRow.slug,
    name: tenantRow.name,
    status: tenantRow.status,
    planKey: tenantRow.plan_key,
    role: membership.role,
    membershipTier: membership.membership_tier,
  };

  // 业务权限始终以当前租户成员角色为准；profiles.role 只保留平台级身份，
  // 避免租户超级管理员被默认的 student 全局角色误判为学生。
  const tenantProfile: AuthProfile | null = profile
    ? {
        ...profile,
        role: membership.role,
        membership_tier: membership.membership_tier,
      }
    : profile;

  return {
    status: "active" as const,
    supabase,
    user,
    profile: tenantProfile,
    platformProfile: profile,
    tenant,
  };
});

export async function requireActiveUser() {
  const context = await getAuthContext();

  if (context.status === "unauthenticated") {
    redirect("/login");
  }

  if (context.status === "inactive") {
    redirect("/account-disabled");
  }

  return context;
}
