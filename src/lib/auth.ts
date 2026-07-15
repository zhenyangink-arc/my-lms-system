import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type AuthProfile = {
  full_name: string | null;
  role: string | null;
  status: string | null;
  membership_tier: string | null;
};

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
    .select("full_name, role, status, membership_tier")
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

  return {
    status: "active" as const,
    supabase,
    user,
    profile,
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
