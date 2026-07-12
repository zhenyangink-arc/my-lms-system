import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { DashboardSidebar } from "./DashboardSidebar";
import { ThemeProvider } from "./ThemeProvider";

type Profile = {
  full_name: string | null;
  role: string | null;
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
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
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileData as Profile | null;

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