import "server-only";

import { notFound } from "next/navigation";

import { requireExecutive } from "@/lib/admin";
import { normalizeMembershipTier } from "@/lib/student-permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MEMBERSHIP_FILTERS,
  PLATFORM_ROLE_FILTERS,
  PROFILE_FILTERS,
  SORT_OPTIONS,
  STATUS_FILTERS,
  TENANT_ROLE_FILTERS,
} from "../constants/account-options";
import type {
  AccountAuditLog,
  AccountDeletionAuditLog,
  AccountDetail,
  AccountDetailAuditLog,
  AccountDetailResult,
  AccountListProfile,
  AccountListResult,
  AccountSearchParams,
} from "./types";

export async function getAccountList(
  params: AccountSearchParams,
): Promise<AccountListResult> {
  const requestedRoleFilter = params.role ?? "all";
  const statusFilter = STATUS_FILTERS.some(
    (item) => item.value === params.status,
  )
    ? (params.status ?? "all")
    : "all";
  const membershipFilter = MEMBERSHIP_FILTERS.some(
    (item) => item.value === params.membership,
  )
    ? (params.membership ?? "all")
    : "all";
  const profileFilter = PROFILE_FILTERS.some(
    (item) => item.value === params.profile,
  )
    ? (params.profile ?? "all")
    : "all";
  const sort = SORT_OPTIONS.some((item) => item.value === params.sort)
    ? (params.sort ?? "newest")
    : "newest";
  const queryText = (params.q ?? "").trim().slice(0, 80);
  const deletedStatus =
    params.deleted === "cleanup"
      ? "cleanup"
      : params.deleted === "1"
        ? "success"
        : null;

  const { tenant, role: viewerRole } = await requireExecutive();
  const roleFilters = tenant ? TENANT_ROLE_FILTERS : PLATFORM_ROLE_FILTERS;
  const roleFilter = roleFilters.some(
    (item) => item.value === requestedRoleFilter,
  )
    ? requestedRoleFilter
    : "all";
  const admin = createAdminClient();
  const { data: membershipData, error: membershipError } = await admin
    .from("tenant_memberships")
    .select("user_id, role, status, membership_tier")
    .match(tenant ? { tenant_id: tenant.id } : {});
  if (membershipError) {
    throw new Error("无法确认机构账号范围，请稍后重试。");
  }
  const membershipUserIds = new Set(
    (membershipData ?? []).map((item) => String(item.user_id)),
  );
  const membershipByUserId = new Map(
    (membershipData ?? []).map((item) => [String(item.user_id), item]),
  );
  const [profilesResult, auditResult, deletionAuditResult] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "id, full_name, email, login_id, role, global_role, status, created_at, registered_at, updated_at, last_active_at, profile_completed_at, registration_source, deactivate_reason, membership_tier",
      )
      .neq("role", "tenant_super_admin")
      .order("registered_at", { ascending: false, nullsFirst: false }),
    tenant
      ? admin
          .from("account_management_audit_logs")
          .select(
            "id, actor_id, target_user_id, action, changed_fields, created_at",
          )
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
    tenant && viewerRole === "tenant_super_admin"
      ? admin
          .from("account_deletion_audit_logs")
          .select(
            "id, target_user_id, target_email, target_full_name, target_role, deletion_reason, related_data_counts, deleted_at",
          )
          .eq("tenant_id", tenant.id)
          .order("deleted_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) {
    throw new Error("账号列表加载失败，请稍后重试。");
  }
  if (auditResult.error || deletionAuditResult.error) {
    throw new Error("账号审计记录加载失败，请稍后重试。");
  }

  const visibleProfiles =
    (profilesResult.data as AccountListProfile[] | null) ?? [];
  const allProfiles = visibleProfiles
    .filter((profile) =>
      tenant
        ? membershipUserIds.has(profile.id)
        : !membershipUserIds.has(profile.id) &&
          (profile.global_role === "platform_deputy" ||
            profile.global_role === "platform_admin" ||
            profile.global_role === "platform_course_inspector"),
    )
    .map((profile) => {
      if (!tenant) {
        return {
          ...profile,
          role: profile.global_role ?? profile.role,
        };
      }
      const membership = membershipByUserId.get(profile.id);
      return membership
        ? {
            ...profile,
            role: membership.role,
            status: membership.status,
            membership_tier: membership.membership_tier,
          }
        : profile;
    });
  const auditLogs = (auditResult.data as AccountAuditLog[] | null) ?? [];
  const deletionAuditLogs =
    (deletionAuditResult.data as AccountDeletionAuditLog[] | null) ?? [];
  const normalizedQuery = queryText.toLocaleLowerCase("zh-CN");

  let profiles = allProfiles.filter((profile) => {
    const matchesRole = roleFilter === "all" || profile.role === roleFilter;
    const matchesStatus =
      statusFilter === "all" || profile.status === statusFilter;
    const matchesMembership =
      !tenant ||
      membershipFilter === "all" ||
      (profile.role === "student" &&
        normalizeMembershipTier(profile.membership_tier) === membershipFilter);
    const matchesProfile =
      profileFilter === "all" ||
      (profileFilter === "started"
        ? Boolean(profile.profile_completed_at)
        : !profile.profile_completed_at);
    const searchableText = `${profile.full_name ?? ""} ${profile.login_id ?? ""} ${profile.email ?? ""} ${profile.id.slice(-8)}`.toLocaleLowerCase(
      "zh-CN",
    );
    return (
      matchesRole &&
      matchesStatus &&
      matchesMembership &&
      matchesProfile &&
      (!normalizedQuery || searchableText.includes(normalizedQuery))
    );
  });

  profiles = [...profiles].sort((a, b) => {
    const aRegistered = new Date(a.registered_at || a.created_at).getTime();
    const bRegistered = new Date(b.registered_at || b.created_at).getTime();
    if (sort === "oldest") return aRegistered - bRegistered;
    if (sort === "name") {
      return (a.full_name || a.email || "").localeCompare(
        b.full_name || b.email || "",
        "zh-CN",
      );
    }
    if (sort === "activity") {
      return (
        new Date(b.last_active_at || 0).getTime() -
        new Date(a.last_active_at || 0).getTime()
      );
    }
    return bRegistered - aRegistered;
  });

  const accountNames = Object.fromEntries(
    allProfiles.map((profile) => [
      profile.id,
      profile.full_name ||
        profile.email ||
        `账号 …${profile.id.slice(-6)}`,
    ]),
  );
  const hasFilters =
    roleFilter !== "all" ||
    statusFilter !== "all" ||
    (Boolean(tenant) && membershipFilter !== "all") ||
    profileFilter !== "all" ||
    Boolean(queryText) ||
    sort !== "newest";

  return {
    scope: tenant ? "tenant" : "platform",
    tenantId: tenant?.id ?? null,
    viewerRole,
    allProfiles,
    profiles,
    auditLogs,
    deletionAuditLogs,
    accountNames,
    filters: {
      role: roleFilter,
      status: statusFilter,
      membership: membershipFilter,
      profile: profileFilter,
      query: queryText,
      sort,
    },
    hasFilters,
    deletedStatus,
  };
}

export async function getAccountDetail(
  profileId: string,
): Promise<AccountDetailResult> {
  const { supabase, tenant, role: viewerRole } = await requireExecutive();
  const admin = createAdminClient();
  const { data: targetMemberships, error: membershipError } = await admin
    .from("tenant_memberships")
    .select("tenant_id, role, status, membership_tier")
    .eq("user_id", profileId);
  if (membershipError) throw membershipError;
  const isInViewerScope = tenant
    ? (targetMemberships ?? []).some(
        (membership) => membership.tenant_id === tenant.id,
      )
    : (targetMemberships ?? []).length === 0;
  if (!isInViewerScope) notFound();
  const [profileResult, auditResult] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "id, full_name, email, role, global_role, status, created_at, registered_at, updated_at, last_active_at, profile_completed_at, registration_source, deactivate_reason, membership_tier, avatar_path, gender, birth_date, address_province, address_city, education_level, education_status, education_completion_month, academic_average, gaokao_has_score, gaokao_score, english_level, math_level, has_korean, topik_level, has_work_experience",
      )
      .eq("id", profileId)
      .neq("role", "tenant_super_admin")
      .maybeSingle(),
    tenant
      ? admin
          .from("account_management_audit_logs")
          .select(
            "id, actor_id, action, changed_fields, before_data, after_data, created_at",
          )
          .eq("tenant_id", tenant.id)
          .eq("target_user_id", profileId)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (!profileResult.data) notFound();
  const storedProfile = profileResult.data as AccountDetail;
  if (
    !tenant &&
    storedProfile.global_role !== "platform_deputy" &&
    storedProfile.global_role !== "platform_admin" &&
    storedProfile.global_role !== "platform_course_inspector"
  ) {
    notFound();
  }
  const currentMembership = tenant
    ? (targetMemberships ?? []).find(
        (membership) => membership.tenant_id === tenant.id,
      )
    : null;
  const profile: AccountDetail = currentMembership
    ? {
        ...storedProfile,
        role: currentMembership.role,
        status: currentMembership.status,
        membership_tier: currentMembership.membership_tier,
      }
    : {
        ...storedProfile,
        role:
          storedProfile.global_role === "platform_deputy" ||
          storedProfile.global_role === "platform_admin" ||
          storedProfile.global_role === "platform_course_inspector"
            ? storedProfile.global_role
            : storedProfile.role,
      };
  const auditLogs = auditResult.error
    ? []
    : ((auditResult.data as AccountDetailAuditLog[] | null) ?? []);

  const actorIds = [
    ...new Set(
      auditLogs
        .map((log) => log.actor_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const actorResult =
    actorIds.length > 0
      ? await admin
          .from("profiles")
          .select("id, full_name, email")
          .in("id", actorIds)
      : { data: [], error: null };
  const actorNames = new Map(
    (actorResult.data ?? []).map((actor) => [
      actor.id,
      actor.full_name || actor.email || `管理员 …${actor.id.slice(-6)}`,
    ]),
  );

  let avatarUrl: string | null = null;
  if (profile.avatar_path) {
    const { data: signedAvatar } = await supabase.storage
      .from("profile-photos")
      .createSignedUrl(profile.avatar_path, 60 * 30);
    avatarUrl = signedAvatar?.signedUrl ?? null;
  }

  const lowerEducation = [
    "high_school",
    "secondary_vocational",
    "technical_school",
  ].includes(profile.education_level ?? "");
  const completionChecks = [
    Boolean(profile.full_name && profile.email),
    Boolean(profile.gender && profile.birth_date),
    Boolean(profile.address_province && profile.address_city),
    Boolean(profile.avatar_path),
    Boolean(
      profile.education_level &&
        profile.education_status &&
        profile.education_completion_month,
    ),
    profile.academic_average !== null,
    !lowerEducation || profile.gaokao_has_score !== null,
    Boolean(profile.english_level),
    Boolean(profile.math_level),
    profile.has_korean !== null &&
      (!profile.has_korean || profile.topik_level !== null),
    profile.has_work_experience !== null,
  ];
  const completionPercent = Math.round(
    (completionChecks.filter(Boolean).length / completionChecks.length) * 100,
  );

  return {
    scope: tenant ? "tenant" : "platform",
    tenantId: tenant?.id ?? null,
    viewerRole,
    profile,
    auditLogs,
    actorNames,
    avatarUrl,
    completionPercent,
    displayName: profile.full_name || "未填写姓名",
  };
}
