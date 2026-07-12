import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { DashboardSidebar } from "./DashboardSidebar";
import { ThemeProvider } from "./ThemeProvider";

type Profile = {
  full_name: string | null;
  role: string | null;
  status: string | null;
};

/*
  判断账号是否可用

  active    = 正常
  inactive  = 已停用
  suspended = 暂停

  旧账号如果 status 是 null，暂时按 active 处理。
*/
function isActiveStatus(status: string | null | undefined) {
  return !status || status === "active";
}

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("full_name, role, status")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData as Profile | null;

  /*
    如果账号被停用或暂停，就不允许进入 dashboard。

    现在先跳回 login。
    后面可以单独做一个页面：
    /account-disabled
  */
  if (!isActiveStatus(profile?.status)) {
    redirect("/login");
  }

  const userName =
    profile?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    "用户";

  const userEmail = user.email ?? "";
  const userRole = profile?.role ?? "student";

  return (
    <ThemeProvider>
      <div className="app-shell min-h-screen">
        <div className="flex min-h-screen">
          <DashboardSidebar
            userName={userName}
            userEmail={userEmail}
            userRole={userRole}
          />

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </ThemeProvider>
  );
}