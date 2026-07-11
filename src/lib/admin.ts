import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type AdminRole = "admin" | "super_admin";

type AdminProfile = {
  role: string | null;
};

function isAdminRole(role: string | null | undefined): role is AdminRole {
  return role === "admin" || role === "super_admin";
}

export async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const adminProfile = profile as AdminProfile | null;

  if (!isAdminRole(adminProfile?.role)) {
    redirect("/dashboard");
  }

  return {
    supabase,
    user,
    role: adminProfile.role,
  };
}