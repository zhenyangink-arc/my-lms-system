import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getDashboardBasePath } from "@/lib/dashboard-path";

type ProfileRow = {
  role: string | null;
  global_role: string | null;
  status: string | null;
};

type MembershipRow = {
  tenant_id: string;
};

function isActiveStatus(status: string | null | undefined) {
  return !status || status === "active";
}

function isPlatformProfile(profile: ProfileRow | null) {
  return profile?.global_role === "platform_owner" || profile?.global_role === "platform_deputy";
}

function dashboardPathFromRequest(pathname: string) {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return { kind: "legacy" as const, dashboardPath: pathname };
  }

  if (pathname === "/platform/dashboard" || pathname.startsWith("/platform/dashboard/")) {
    return {
      kind: "platform" as const,
      dashboardPath: pathname.slice("/platform".length),
    };
  }

  const tenantMatch = pathname.match(/^\/t\/([^/]+)(\/dashboard(?:\/.*)?$)/);
  if (!tenantMatch) return null;

  return {
    kind: "tenant" as const,
    requestedTenantSlug: tenantMatch[1],
    dashboardPath: tenantMatch[2],
  };
}

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

export async function proxy(request: NextRequest) {
  const requestedSpace = dashboardPathFromRequest(request.nextUrl.pathname);
  if (!requestedSpace) return NextResponse.next();

  let cookieResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookieResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return copyResponseCookies(cookieResponse, NextResponse.redirect(loginUrl));
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role,global_role,status")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileData as ProfileRow | null;

  if (!isActiveStatus(profile?.status)) {
    const disabledUrl = request.nextUrl.clone();
    disabledUrl.pathname = "/account-disabled";
    disabledUrl.search = "";
    return copyResponseCookies(cookieResponse, NextResponse.redirect(disabledUrl));
  }

  let tenantSlug: string | null = null;
  const platformSpace = isPlatformProfile(profile);

  if (!platformSpace) {
    const { data: membershipData } = await supabase
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const membership = membershipData as MembershipRow | null;

    if (membership) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("slug")
        .eq("id", membership.tenant_id)
        .eq("status", "active")
        .maybeSingle();
      tenantSlug = tenant?.slug ?? null;
    }
  }

  if (!platformSpace && !tenantSlug) {
    return new NextResponse("当前账号尚未加入可用租户。", { status: 403 });
  }

  const dashboardBasePath = getDashboardBasePath(tenantSlug);
  const canonicalPath = `${dashboardBasePath}${requestedSpace.dashboardPath.slice("/dashboard".length)}`;
  const isCorrectSpace = platformSpace
    ? requestedSpace.kind === "platform"
    : requestedSpace.kind === "tenant" && requestedSpace.requestedTenantSlug === tenantSlug;

  if (!isCorrectSpace) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.pathname = canonicalPath;
    return copyResponseCookies(cookieResponse, NextResponse.redirect(canonicalUrl));
  }

  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = requestedSpace.dashboardPath;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-dashboard-space", platformSpace ? "platform" : "tenant");
  if (tenantSlug) requestHeaders.set("x-tenant-slug", tenantSlug);

  return copyResponseCookies(
    cookieResponse,
    NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } })
  );
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/platform/dashboard/:path*",
    "/t/:tenantSlug/dashboard/:path*",
  ],
};
