import { cache } from "react";
import { redirect } from "next/navigation";

import { requireActiveUser } from "@/lib/auth";
import { getDashboardBasePath } from "@/lib/dashboard-path";

export type DashboardEntryKind = "legacy" | "platform" | "tenant";

type ActiveUserContext = Awaited<ReturnType<typeof requireActiveUser>>;

type MembershipRow = {
  tenant_id: string;
};

type TenantRow = {
  slug: string;
};

export type DashboardAccess = {
  auth: ActiveUserContext;
  space: "platform" | "tenant";
  tenantSlug: string | null;
  dashboardBasePath: string;
};

const TENANT_ACCESS_ERROR_MESSAGES = new Set([
  "当前账号尚未加入可用租户，请联系管理员。",
  "当前租户不可用，请联系管理员。",
]);

function isPlatformProfile(context: ActiveUserContext) {
  const globalRole = context.platformProfile?.global_role;
  return (
    globalRole === "platform_owner" ||
    globalRole === "platform_deputy" ||
    globalRole === "platform_admin" ||
    globalRole === "platform_course_inspector"
  );
}

async function requireExistingActiveUser() {
  try {
    return await requireActiveUser();
  } catch (error) {
    if (
      error instanceof Error &&
      TENANT_ACCESS_ERROR_MESSAGES.has(error.message)
    ) {
      redirect("/access-denied");
    }

    throw error;
  }
}

async function resolveLegacyTenantSlug(context: ActiveUserContext) {
  if (context.tenant?.slug) return context.tenant.slug;

  // Keep the existing Proxy behavior for historical profiles without a
  // recognized platform global_role: resolve their first active membership
  // instead of treating role="tenant_operator" as a platform identity here.
  const { data: membershipData } = await context.supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", context.user.id)
    .eq("status", "active")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const membership = membershipData as MembershipRow | null;

  if (!membership) redirect("/access-denied");

  const { data: tenantData } = await context.supabase
    .from("tenants")
    .select("slug")
    .eq("id", membership.tenant_id)
    .eq("status", "active")
    .maybeSingle();
  const tenant = tenantData as TenantRow | null;

  if (!tenant?.slug) redirect("/access-denied");
  return tenant.slug;
}

export const requireDashboardAccess = cache(
  async (
    kind: DashboardEntryKind,
    requestedTenantSlug: string | null = null
  ): Promise<DashboardAccess> => {
    const auth = await requireExistingActiveUser();
    const platformSpace = isPlatformProfile(auth);

    if (platformSpace) {
      const dashboardBasePath = getDashboardBasePath(null);

      if (kind === "tenant") redirect(dashboardBasePath);

      return {
        auth,
        space: "platform",
        tenantSlug: null,
        dashboardBasePath,
      };
    }

    const tenantSlug = await resolveLegacyTenantSlug(auth);
    const dashboardBasePath = getDashboardBasePath(tenantSlug);

    if (kind === "platform") redirect(dashboardBasePath);

    if (
      kind === "tenant" &&
      requestedTenantSlug !== null &&
      requestedTenantSlug !== tenantSlug
    ) {
      redirect(dashboardBasePath);
    }

    return {
      auth,
      space: "tenant",
      tenantSlug,
      dashboardBasePath,
    };
  }
);
